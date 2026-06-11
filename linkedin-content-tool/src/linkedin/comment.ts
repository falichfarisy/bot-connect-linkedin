import { LinkedInClient } from './client';
import type { LinkedInComment } from './types';

export interface CommentResult {
  success: boolean;
  commentUrn?: string;
  error?: string;
}

/**
 * Posts the first comment on a LinkedIn post within 60 seconds of publication.
 * Adds a small random delay (2-5 seconds) for natural timing.
 * Validates comment length (≤1250 chars).
 */
export async function postFirstComment(
  client: LinkedInClient,
  postUrn: string,
  comment: string,
  memberId: string,
): Promise<CommentResult> {
  if (comment.length > 1250) {
    return {
      success: false,
      error: `Comment too long: ${comment.length} chars (max 1250)`,
    };
  }

  const delay = 2000 + Math.random() * 3000;
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    const linkedInComment: LinkedInComment = {
      actor: `urn:li:person:${memberId}`,
      object: postUrn,
      message: { text: comment },
    };

    const response = await client.createComment(postUrn, linkedInComment);
    return {
      success: true,
      commentUrn: response.commentUrn,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error posting comment',
    };
  }
}
