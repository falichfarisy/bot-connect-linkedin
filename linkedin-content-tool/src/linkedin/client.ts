import type {
  LinkedInPost,
  LinkedInComment,
  LinkedInAnalytics,
  CreatePostResponse,
  CreateCommentResponse,
  MemberInfo,
} from "./types";

export interface LinkedInClient {
  createPost(post: LinkedInPost): Promise<CreatePostResponse>;
  createComment(
    postUrn: string,
    comment: LinkedInComment,
  ): Promise<CreateCommentResponse>;
  getPostAnalytics(postUrn: string): Promise<LinkedInAnalytics>;
  getMemberId(): Promise<MemberInfo>;
}
