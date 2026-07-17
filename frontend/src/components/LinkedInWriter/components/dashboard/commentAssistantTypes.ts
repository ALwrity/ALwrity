/**
 * UI types for Comment Assistant inbox.
 * Phase 1 uses empty/loading shells; Phase 3 binds these to the API.
 */

export type CommentAssistantTab = 'needs_reply' | 'active' | 'older' | 'manual';

export interface CommentAssistantCommentView {
  id: string;
  authorName: string;
  text: string;
  timeLabel: string;
  liked?: boolean;
}

export interface CommentAssistantPostGroupView {
  postId: string;
  postSnippet: string;
  /** null = comments still loading (progressive skeleton). */
  comments: CommentAssistantCommentView[] | null;
}
