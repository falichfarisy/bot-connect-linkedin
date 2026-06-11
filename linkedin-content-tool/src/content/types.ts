export interface DraftMetadata {
  id: string;
  title: string;
  status: "idea" | "draft" | "review" | "approved" | "scheduled" | "published" | "failed";
  topic: string;
  angle?: string;
  pillar?: string;
  scheduledAt?: string; // ISO 8601
  publishedAt?: string;
  linkedinPostUrn?: string;
  firstComment?: string;
  firstCommentUrn?: string;
  voiceProfile: string;
  aiModel: string;
  humanizationPasses: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftSummary {
  path: string;
  id: string;
  title: string;
  status: string;
  topic: string;
  scheduledAt?: string;
  createdAt: string;
}

export interface DraftResult {
  path: string;
  content: string;
  metadata: DraftMetadata;
  antiSlopCheck: { passes: boolean; matches: string[] };
  humanizationPasses: number;
}
