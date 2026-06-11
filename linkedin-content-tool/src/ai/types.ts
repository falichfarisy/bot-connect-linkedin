export interface DraftOptions {
  topic: string;
  angle?: string; // e.g., "contrarian", "howto", "story"
  audience?: string;
  targetLength?: number; // default: 1500-2500 chars
  voiceProfile?: string; // YAML content as string
}

export interface Draft {
  content: string;
  metadata: {
    topic: string;
    angle: string;
    wordCount: number;
    charCount: number;
    hook: string; // first 200 chars
    aiModel: string;
    humanizationPasses: number;
  };
}
