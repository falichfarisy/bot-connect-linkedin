import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { OpenCodeGoProvider } from '../opencode-go';
import { buildDraftPrompt } from '../prompt-builder';
import type { AIConfig } from '../../config/schema';
import type { DraftOptions } from '../types';

const TEST_CONFIG: AIConfig = {
  provider: 'opencode-go',
  apiKey: 'test-key',
  apiEndpoint: 'https://api.test.com/v1/chat',
  model: 'test-model',
  humanizationPasses: 1,
};

const TEST_OPTIONS: DraftOptions = {
  topic: 'AI in recruitment',
  angle: 'contrarian',
  audience: 'HR professionals',
  targetLength: 2000,
};

describe('OpenCodeGoProvider', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  test('generateDraft returns valid Draft with metadata', async () => {
    const mockContent = 'Here is a contrarian take on AI in recruitment that will challenge your assumptions. Stop using automated filters. Start talking to candidates.';

    globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe(TEST_CONFIG.apiEndpoint);
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_CONFIG.apiKey}`,
      });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: mockContent } }],
        }),
        { status: 200 }
      );
    };

    const provider = new OpenCodeGoProvider(TEST_CONFIG);
    const draft = await provider.generateDraft('test prompt', TEST_OPTIONS);

    expect(draft.content).toBe(mockContent);
    expect(draft.metadata.topic).toBe('AI in recruitment');
    expect(draft.metadata.angle).toBe('contrarian');
    expect(draft.metadata.wordCount).toBe(mockContent.split(/\s+/).length);
    expect(draft.metadata.charCount).toBe(mockContent.length);
    expect(draft.metadata.hook).toBe(mockContent.slice(0, 200));
    expect(draft.metadata.aiModel).toBe('test-model');
    expect(draft.metadata.humanizationPasses).toBe(0);
  });

  test('generateDraft throws on API error', async () => {
    globalThis.fetch = async () => {
      return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    };

    const provider = new OpenCodeGoProvider(TEST_CONFIG);
    await expect(provider.generateDraft('prompt', TEST_OPTIONS)).rejects.toThrow('AI API error: 401 Unauthorized');
  });

  test('refineDraft returns refined text', async () => {
    const originalDraft = 'Some draft content here.';
    const refinedContent = 'This is the refined version of the draft.';

    globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      expect(body.messages[0].content).toContain('Please refine the following draft');
      expect(body.messages[0].content).toContain(originalDraft);

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: refinedContent } }],
        }),
        { status: 200 }
      );
    };

    const provider = new OpenCodeGoProvider(TEST_CONFIG);
    const result = await provider.refineDraft(originalDraft, 'Make it more concise');

    expect(result).toBe(refinedContent);
  });

  test('refineDraft returns original draft on empty API response', async () => {
    const originalDraft = 'Original draft text.';

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const provider = new OpenCodeGoProvider(TEST_CONFIG);
    const result = await provider.refineDraft(originalDraft, 'Improve it');

    expect(result).toBe(originalDraft);
  });
});

describe('buildDraftPrompt', () => {
  test('includes voice profile content when provided', () => {
    const voiceProfile = 'tone: professional\nstyle: direct';
    const prompt = buildDraftPrompt(TEST_OPTIONS, voiceProfile);

    expect(prompt).toContain('Voice Profile:');
    expect(prompt).toContain(voiceProfile);
  });

  test('includes anti-slop style guidelines', () => {
    const prompt = buildDraftPrompt(TEST_OPTIONS, '');

    expect(prompt).toContain('Style Guidelines');
    expect(prompt).toContain('Avoid buzzwords and corporate jargon');
    expect(prompt).toContain('Start with a hook');
    expect(prompt).toContain('End with a question');
  });

  test('includes angle-specific instructions for contrarian', () => {
    const prompt = buildDraftPrompt({ ...TEST_OPTIONS, angle: 'contrarian' }, '');

    expect(prompt).toContain('Take a contrarian stance');
  });

  test('includes angle-specific instructions for howto', () => {
    const prompt = buildDraftPrompt({ ...TEST_OPTIONS, angle: 'howto' }, '');

    expect(prompt).toContain('actionable, step-by-step advice');
  });

  test('includes angle-specific instructions for story', () => {
    const prompt = buildDraftPrompt({ ...TEST_OPTIONS, angle: 'story' }, '');

    expect(prompt).toContain('personal story or experience');
  });

  test('includes audience when provided', () => {
    const prompt = buildDraftPrompt(TEST_OPTIONS, '');

    expect(prompt).toContain('Target audience: HR professionals');
  });

  test('includes target length when provided', () => {
    const prompt = buildDraftPrompt(TEST_OPTIONS, '');

    expect(prompt).toContain('Target length: approximately 2000 characters');
  });
});
