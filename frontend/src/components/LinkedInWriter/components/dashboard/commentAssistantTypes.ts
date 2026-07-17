/**
 * UI + API types for Comment Assistant inbox.
 */

export type CommentAssistantTab = 'needs_reply' | 'active' | 'older' | 'manual';

export type CommentAssistantPriority = 'needs_reply' | 'active' | 'older' | 'all';

export interface CommentAssistantCommentView {
  id: string;
  authorName: string;
  text: string;
  timeLabel: string;
  liked?: boolean;
  draftText?: string;
  replyBusy?: boolean;
  draftBusy?: boolean;
  likeBusy?: boolean;
}

export interface CommentAssistantPostGroupView {
  postId: string;
  socialId: string;
  postSnippet: string;
  /** null = comments still loading (progressive skeleton). */
  comments: CommentAssistantCommentView[] | null;
  error?: string | null;
  hasMoreComments?: boolean;
  commentsCursor?: string | null;
}

/** Backend inbox comment item. */
export interface CommentAssistantCommentApi {
  id: string;
  text: string;
  author: { name: string; headline?: string | null; avatar_url?: string | null };
  author_id?: string | null;
  created_at?: string;
  reply_count?: number;
  reaction_count?: number;
  user_reacted?: string | null;
  needs_reply?: boolean;
  priority?: 'needs_reply' | 'active' | 'older';
}

export interface CommentAssistantPostGroupApi {
  post_id: string;
  social_id: string;
  post_snippet: string;
  comment_count_hint?: number;
  comments: CommentAssistantCommentApi[];
  has_more_comments?: boolean;
  comments_cursor?: string | null;
  error?: string | null;
}

export interface CommentAssistantInboxResponse {
  groups: CommentAssistantPostGroupApi[];
  priority: CommentAssistantPriority;
  posts_considered: number;
  older_days: number;
  counts: Record<string, number>;
}

export interface CommentAssistantLikeResponse {
  success: boolean;
  comment_id: string;
  reaction_type: string;
}
