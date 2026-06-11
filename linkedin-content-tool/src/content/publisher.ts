import type { LinkedInClient } from "../linkedin/client";
import { readDraft, updateDraft } from "./draft";
import { postFirstComment } from "../linkedin/comment";
import type { DraftMetadata } from "./types";
import type { AppConfig } from "../config/schema";
import { getCalendarDb } from "../db/connection";
import type { LinkedInPost } from "../linkedin/types";

export interface PublishResult {
  success: boolean;
  postUrn?: string;
  commentUrn?: string;
  commentFailed?: boolean;
  error?: string;
}

export async function publishNow(
  draftPath: string,
  client: LinkedInClient,
  config: AppConfig,
): Promise<PublishResult> {
  try {
    const draft = readDraft(draftPath);

    const validStatuses = ["approved", "scheduled"];
    if (!validStatuses.includes(draft.metadata.status)) {
      return {
        success: false,
        error: `Invalid status: ${draft.metadata.status}. Only 'approved' or 'scheduled' drafts can be published.`,
      };
    }

    const maxLength = config.content.maxPostLength ?? 3000;
    if (draft.content.length > maxLength) {
      return {
        success: false,
        error: `Content exceeds maximum length of ${maxLength} characters.`,
      };
    }

    const memberInfo = await client.getMemberId();

    const linkedInPost: LinkedInPost = {
      author: `urn:li:person:${memberInfo.memberId}`,
      commentary: draft.content,
      visibility: "PUBLIC",
      lifecycleState: "PUBLISHED",
    };
    const postResponse = await client.createPost(linkedInPost);

    let commentResult:
      | { success: boolean; commentUrn?: string; error?: string }
      | undefined;
    if (draft.metadata.firstComment && draft.metadata.firstComment.trim().length > 0) {
      commentResult = await postFirstComment(
        client,
        postResponse.postUrn,
        draft.metadata.firstComment,
        memberInfo.memberId,
      );
    }

    const updatedMetadata: Partial<DraftMetadata> = {
      status: "published",
      publishedAt: new Date().toISOString(),
      linkedinPostUrn: postResponse.postUrn,
      ...(commentResult?.commentUrn
        ? { firstCommentUrn: commentResult.commentUrn }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    updateDraft(draftPath, draft.content, updatedMetadata);

    const db = getCalendarDb();
    try {
      const existing = db
        .query<{ id: string }, [string]>(
          "SELECT id FROM content_items WHERE id = ?",
        )
        .get(draft.metadata.id);

      if (!existing) {
        db.run(
          `INSERT INTO content_items (
            id, account_id, title, status, draft_path,
            published_at, linkedin_post_urn, first_comment,
            first_comment_urn, comment_failed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            draft.metadata.id,
            "default",
            draft.metadata.title,
            "published",
            draftPath,
            new Date().toISOString(),
            postResponse.postUrn,
            draft.metadata.firstComment ?? null,
            commentResult?.commentUrn ?? null,
            commentResult && !commentResult.success ? 1 : 0,
            draft.metadata.createdAt,
            new Date().toISOString(),
          ],
        );
      } else {
        db.run(
          `UPDATE content_items SET
            status = ?, published_at = ?, linkedin_post_urn = ?,
            first_comment_urn = ?, comment_failed = ?, updated_at = ?
           WHERE id = ?`,
          [
            "published",
            new Date().toISOString(),
            postResponse.postUrn,
            commentResult?.commentUrn ?? null,
            commentResult && !commentResult.success ? 1 : 0,
            new Date().toISOString(),
            draft.metadata.id,
          ],
        );
      }

      db.run(
        `INSERT INTO state_transitions (item_id, from_status, to_status, created_at)
         VALUES (?, ?, ?, ?)`,
        [
          draft.metadata.id,
          draft.metadata.status,
          "published",
          new Date().toISOString(),
        ],
      );
    } finally {
      db.close();
    }

    return {
      success: true,
      postUrn: postResponse.postUrn,
      commentUrn: commentResult?.commentUrn,
      commentFailed: commentResult ? !commentResult.success : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
