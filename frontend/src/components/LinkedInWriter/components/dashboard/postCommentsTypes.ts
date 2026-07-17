/**
 * Types for LinkedIn post comments (Unipile proxy).
 */

export interface PostCommentAuthor {
  name: string;
  headline?: string | null;
  avatar_url?: string | null;
  profile_url?: string | null;
}

export interface PostComment {
  id: string;
  text: string;
  author: PostCommentAuthor;
  created_at: string;
  reply_count: number;
  reaction_count: number;
  impressions_count?: number;
  /** Reaction type if the connected account reacted (e.g. LIKE). */
  user_reacted?: string | null;
  /** Set when this item is a nested reply under a parent comment. */
  parent_comment_id?: string | null;
}

export interface PostCommentsListResponse {
  items: PostComment[];
  cursor?: string | null;
  has_more: boolean;
  total_count?: number | null;
}

export interface PostCommentMention {
  name: string;
  profile_id: string;
}

export interface PostCommentReplyRequest {
  comment_id: string;
  text: string;
  mentions?: PostCommentMention[];
}

export interface PostCommentReplyResponse {
  success: boolean;
  comment_id?: string | null;
}

export const UNIPILE_MAX_COMMENT_LENGTH = 1250;

export function formatReplyCountLabel(count: number): string {
  return count === 1 ? '1 reply' : `${count} replies`;
}

export function formatReactionCountLabel(count: number): string {
  return count === 1 ? '1 reaction' : `${count} reactions`;
}
