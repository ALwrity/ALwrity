/**
 * UI + API types for Comment Assistant inbox.
 */

export type CommentAssistantTab = 'needs_reply' | 'active' | 'older' | 'manual';

export type CommentAssistantPriority = 'needs_reply' | 'active' | 'older' | 'all';

export interface CommentAssistantReplyView {
  id: string;
  text: string;
  authorName: string;
  authorId?: string | null;
  timeLabel: string;
  isMine: boolean;
  /** Attached image URL when the reply includes media. */
  imageUrl?: string | null;
  liked?: boolean;
  userReacted?: string | null;
  reactionCount?: number;
  replyBusy?: boolean;
  likeBusy?: boolean;
}

export interface CommentAssistantCommentView {
  id: string;
  authorName: string;
  authorId?: string | null;
  headline?: string | null;
  avatarUrl?: string | null;
  text: string;
  timeLabel: string;
  liked?: boolean;
  /** Unipile reaction type when user already reacted (like, celebrate, …). */
  userReacted?: string | null;
  reactionCount?: number;
  replyCount?: number;
  /** Attached image URL when the comment includes media. */
  imageUrl?: string | null;
  draftText?: string;
  replyBusy?: boolean;
  draftBusy?: boolean;
  likeBusy?: boolean;
  myReplies?: CommentAssistantReplyView[];
  /** Lazily loaded full thread (Trends-style Show replies). */
  threadReplies?: CommentAssistantReplyView[];
}

export interface CommentAssistantPostGroupView {
  postId: string;
  socialId: string;
  postSnippet: string;
  /** Full post text for See more. */
  postText: string;
  /** null = comments still loading (progressive skeleton). */
  comments: CommentAssistantCommentView[] | null;
  error?: string | null;
  hasMoreComments?: boolean;
  commentsCursor?: string | null;
}

/** Backend inbox reply preview. */
export interface CommentAssistantReplyApi {
  id: string;
  text: string;
  author_name?: string;
  author_id?: string | null;
  created_at?: string;
  is_mine?: boolean;
  image_url?: string | null;
  reaction_count?: number;
  user_reacted?: string | null;
}

/** Backend inbox comment item. */
export interface CommentAssistantCommentApi {
  id: string;
  text: string;
  author: {
    name: string;
    headline?: string | null;
    avatar_url?: string | null;
    profile_url?: string | null;
  };
  author_id?: string | null;
  created_at?: string;
  reply_count?: number;
  reaction_count?: number;
  user_reacted?: string | null;
  image_url?: string | null;
  needs_reply?: boolean;
  priority?: 'needs_reply' | 'active' | 'older';
  my_replies?: CommentAssistantReplyApi[];
}

export interface CommentAssistantPostGroupApi {
  post_id: string;
  social_id: string;
  post_snippet: string;
  post_text?: string;
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
