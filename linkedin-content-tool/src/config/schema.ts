export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string; // e.g., "202605"
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string; // ISO 8601
}

export interface AIConfig {
  provider: "opencode-go";
  apiKey: string;
  apiEndpoint: string;
  model: string;
  humanizationPasses: number; // 1-4, default 1
}

export interface ContentConfig {
  draftsDir: string; // default: "content/drafts"
  voiceProfilesDir: string; // default: "content/voice-profiles"
  defaultVoiceProfile: string; // default: "default"
  maxPostLength: number; // default: 3000
  maxCommentLength: number; // default: 1250
}

export interface SchedulerConfig {
  enabled: boolean; // default: false
  checkIntervalMinutes: number; // default: 5
  minGapMinutes: number; // default: 5 (collision detection)
}

export interface AppConfig {
  linkedin: LinkedInConfig;
  ai: AIConfig;
  content: ContentConfig;
  scheduler: SchedulerConfig;
  timezone: string; // e.g., "Asia/Jakarta"
}
