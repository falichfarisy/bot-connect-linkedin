import { DraftOptions } from './types';

export function buildDraftPrompt(options: DraftOptions, voiceProfile: string): string {
  const angle = options.angle || 'general';

  let prompt = `Write a LinkedIn post about "${options.topic}".`;

  if (angle === 'contrarian') prompt += '\nTake a contrarian stance that challenges common beliefs.';
  else if (angle === 'howto') prompt += '\nProvide actionable, step-by-step advice.';
  else if (angle === 'story') prompt += '\nFrame this as a personal story or experience.';
  else prompt += '\nShare insights and perspectives.';

  if (options.audience) {
    prompt += `\nTarget audience: ${options.audience}.`;
  }

  if (options.targetLength) {
    prompt += `\nTarget length: approximately ${options.targetLength} characters.`;
  }

  // Anti-slop instructions
  prompt += `\n\nIMPORTANT - Style Guidelines:
- Write naturally, as a human expert would
- Avoid buzzwords and corporate jargon
- Use short paragraphs and punchy sentences
- Start with a hook in the first 200 characters
- Be specific and concrete
- End with a question to encourage engagement`;

  // Voice profile
  if (voiceProfile) {
    prompt += `\n\nVoice Profile:\n${voiceProfile}`;
  }

  return prompt;
}
