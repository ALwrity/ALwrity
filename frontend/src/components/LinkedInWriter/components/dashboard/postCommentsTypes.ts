/**
 * Types for LinkedIn post comments (Unipile proxy — Phase 1 UI / Phase 2+ API).
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
}

export interface PostCommentsListResponse {
  items: PostComment[];
  cursor?: string | null;
  has_more: boolean;
  total_count?: number | null;
}

export interface PostCommentReplyRequest {
  comment_id: string;
  text: string;
}

export interface PostCommentReplyResponse {
  success: boolean;
  comment_id?: string | null;
}

export const UNIPILE_MAX_COMMENT_LENGTH = 1250;
