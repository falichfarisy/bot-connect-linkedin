import type {
  LinkedInPost,
  LinkedInComment,
  LinkedInAnalytics,
  CreatePostResponse,
  CreateCommentResponse,
  MemberInfo,
} from "./types";
import type { LinkedInClient } from "./client";

interface CallLogEntry {
  method: string;
  timestamp: number;
  data: unknown;
}

export class MockLinkedInClient implements LinkedInClient {
  private callLog: CallLogEntry[] = [];
  private simulateAuthError: boolean;
  private posts: LinkedInPost[] = [];
  private comments: LinkedInComment[] = [];

  constructor(options?: { simulateAuthError?: boolean }) {
    this.simulateAuthError = options?.simulateAuthError ?? false;
  }

  private checkAuth(): void {
    if (this.simulateAuthError) {
      throw new Error("Authentication error: token expired or invalid");
    }
  }

  private logCall(method: string, data: unknown): void {
    this.callLog.push({ method, timestamp: Date.now(), data });
  }

  private generateUrn(): string {
    const digits = Math.floor(Math.random() * 10_000_000_000);
    return `urn:li:activity:${digits}`;
  }

  async createPost(post: LinkedInPost): Promise<CreatePostResponse> {
    this.checkAuth();
    this.logCall("createPost", post);

    await new Promise((resolve) => setTimeout(resolve, 100));

    this.posts.push(post);
    return { postUrn: this.generateUrn() };
  }

  async createComment(
    _postUrn: string,
    comment: LinkedInComment,
  ): Promise<CreateCommentResponse> {
    this.checkAuth();
    this.logCall("createComment", { _postUrn, comment });

    this.comments.push(comment);
    return { commentUrn: this.generateUrn() };
  }

  async getPostAnalytics(
    _postUrn: string,
  ): Promise<LinkedInAnalytics> {
    this.checkAuth();
    this.logCall("getPostAnalytics", { _postUrn });

    return {
      impressions: 1234,
      reactions: 45,
      comments: 12,
      shares: 3,
      saves: 8,
      linkClicks: 20,
      followersGained: 5,
      profileViews: 67,
    };
  }

  async getMemberId(): Promise<MemberInfo> {
    this.checkAuth();
    this.logCall("getMemberId", {});

    return { memberId: "mock-member-123", name: "Mock User" };
  }

  getCallLog(): CallLogEntry[] {
    return [...this.callLog];
  }

  clearCallLog(): void {
    this.callLog = [];
  }
}
