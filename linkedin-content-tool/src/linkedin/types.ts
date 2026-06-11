export interface LinkedInPost {
  author: string; // urn:li:person:{id}
  commentary: string;
  visibility: "PUBLIC";
  lifecycleState: "PUBLISHED";
}

export interface LinkedInComment {
  actor: string;
  object: string; // urn:li:activity:{id}
  message: { text: string };
}

export interface LinkedInAnalytics {
  impressions?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  linkClicks?: number;
  followersGained?: number;
  profileViews?: number;
}

export interface CreatePostResponse {
  postUrn: string; // from x-restli-id header
}

export interface CreateCommentResponse {
  commentUrn: string;
}

export interface MemberInfo {
  memberId: string;
  name?: string;
}
