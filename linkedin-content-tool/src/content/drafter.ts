import { AIProvider } from '../ai/provider';
import { DraftOptions, Draft } from '../ai/types';
import { AppConfig } from '../config/schema';
import { loadConfig } from '../config/loader';
import { checkAntiSlop } from './anti-slop';
import { buildDraftPrompt } from '../ai/prompt-builder';
import { createDraft, readDraft } from './draft';
import { loadVoiceProfile } from './voice-profile';
import { OpenCodeGoProvider } from '../ai/opencode-go';
import { stringifyYaml } from '../utils/yaml';
import type { DraftResult, DraftMetadata } from './types';

export async function generateDraft(
  options: DraftOptions,
  config?: AppConfig,
  provider?: AIProvider,
): Promise<DraftResult> {
  const resolvedConfig = config ?? loadConfig();

  const aiProvider = provider ?? new OpenCodeGoProvider(resolvedConfig.ai);

  const voiceProfileName = options.voiceProfile ?? resolvedConfig.content.defaultVoiceProfile;
  const voiceProfile = loadVoiceProfile(voiceProfileName, resolvedConfig.content.voiceProfilesDir);
  const voiceProfileYaml = stringifyYaml(voiceProfile as unknown as Record<string, unknown>);

  const fullPrompt = buildDraftPrompt(options, voiceProfileYaml);

  let draft: Draft = await aiProvider.generateDraft(fullPrompt, options);
  let antiSlop = checkAntiSlop(draft.content);
  let passes = 0;

  while (!antiSlop.passes && passes < resolvedConfig.ai.humanizationPasses) {
    const feedback = `Remove these AI-sounding phrases: ${antiSlop.matches.join(", ")}. Write in a natural, human voice.`;
    const refined = await aiProvider.refineDraft(draft.content, feedback);
    draft.content = refined;
    antiSlop = checkAntiSlop(draft.content);
    passes++;
  }

  const maxLength = resolvedConfig.content.maxPostLength;
  if (draft.content.length > maxLength) {
    draft.content = draft.content.slice(0, maxLength);
  }

  const firstLine = draft.content.split('\n')[0].replace(/^#+\s*/, '').trim();
  const title = firstLine || options.topic;

  const draftMetadata: Partial<DraftMetadata> = {
    topic: options.topic,
    voiceProfile: voiceProfileName,
    aiModel: draft.metadata.aiModel,
    humanizationPasses: passes,
  };

  if (options.angle) {
    draftMetadata.angle = options.angle;
  }

  const filePath = createDraft(
    title.slice(0, 120),
    draft.content,
    draftMetadata,
    resolvedConfig.content.draftsDir,
  );

  const { metadata } = readDraft(filePath);

  return {
    path: filePath,
    content: draft.content,
    metadata,
    antiSlopCheck: antiSlop,
    humanizationPasses: passes,
  };
}
