import { AIProvider } from './provider';
import type { AIConfig } from '../config/schema';
import { Draft, DraftOptions } from './types';

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('Unreachable');
}

export class OpenCodeGoProvider implements AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async generateDraft(prompt: string, options: DraftOptions): Promise<Draft> {
    return withRetry(async () => {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content || data.content || '';

      return {
        content,
        metadata: {
          topic: options.topic,
          angle: options.angle || 'general',
          wordCount: content.split(/\s+/).length,
          charCount: content.length,
          hook: content.slice(0, 200),
          aiModel: this.config.model,
          humanizationPasses: 0,
        },
      };
    });
  }

  async refineDraft(draft: string, feedback: string): Promise<string> {
    return withRetry(async () => {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: `Please refine the following draft based on this feedback: ${feedback}\n\nDraft:\n${draft}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content || data.content || draft;
    });
  }
}
