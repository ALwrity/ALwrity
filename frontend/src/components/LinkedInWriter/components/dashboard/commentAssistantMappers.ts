/**
 * Map Comment Assistant API payloads to compact UI view models.
 */

import type {
  CommentAssistantCommentApi,
  CommentAssistantCommentView,
  CommentAssistantPostGroupApi,
  CommentAssistantPostGroupView,
} from './commentAssistantTypes';

export function formatTimeLabel(iso: string | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  try {
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function mapCommentToView(
  comment: CommentAssistantCommentApi
): CommentAssistantCommentView {
  return {
    id: comment.id,
    authorName: comment.author?.name || 'Unknown',
    text: comment.text || '',
    timeLabel: formatTimeLabel(comment.created_at),
    liked: Boolean(comment.user_reacted),
  };
}

export function mapGroupToView(
  group: CommentAssistantPostGroupApi
): CommentAssistantPostGroupView {
  return {
    postId: group.post_id,
    socialId: group.social_id,
    postSnippet: group.post_snippet || '',
    comments: (group.comments || []).map(mapCommentToView),
    error: group.error || null,
    hasMoreComments: Boolean(group.has_more_comments),
    commentsCursor: group.comments_cursor || null,
  };
}
