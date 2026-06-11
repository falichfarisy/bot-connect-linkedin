import type { AppConfig } from "./schema";

export const DEFAULT_CONFIG: AppConfig = {
  timezone: "UTC",
  linkedin: {
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:3000/callback",
    apiVersion: "202605",
  },
  ai: {
    provider: "opencode-go",
    apiKey: "",
    apiEndpoint: "https://api.opencode-go.example.com",
    model: "claude-sonnet-4",
    humanizationPasses: 1,
  },
  content: {
    draftsDir: "content/drafts",
    voiceProfilesDir: "content/voice-profiles",
    defaultVoiceProfile: "default",
    maxPostLength: 3000,
    maxCommentLength: 1250,
  },
  scheduler: {
    enabled: false,
    checkIntervalMinutes: 5,
    minGapMinutes: 5,
  },
};
