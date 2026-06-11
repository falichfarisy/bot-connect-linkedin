import { Draft, DraftOptions } from './types';

export interface AIProvider {
  generateDraft(prompt: string, options: DraftOptions): Promise<Draft>;
  refineDraft(draft: string, feedback: string): Promise<string>;
}
