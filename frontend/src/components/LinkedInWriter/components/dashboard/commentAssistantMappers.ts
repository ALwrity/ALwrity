/**
 * Map Comment Assistant API payloads to compact UI view models.
 */

import type {
  CommentAssistantCommentApi,
  CommentAssistantCommentView,
  CommentAssistantPostGroupApi,
  CommentAssistantPostGroupView,
  CommentAssistantReplyApi,
  CommentAssistantReplyView,
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

function mapReplyToView(reply: CommentAssistantReplyApi): CommentAssistantReplyView {
  return {
    id: reply.id,
    text: reply.text || '',
    authorName: reply.is_mine ? 'You' : reply.author_name || 'Someone',
    authorId: reply.author_id || null,
    timeLabel: formatTimeLabel(reply.created_at),
    isMine: Boolean(reply.is_mine),
    imageUrl: reply.image_url || null,
    liked: Boolean(reply.user_reacted),
    userReacted: reply.user_reacted || null,
    reactionCount: reply.reaction_count ?? 0,
  };
}

export function mapCommentToView(
  comment: CommentAssistantCommentApi
): CommentAssistantCommentView {
  return {
    id: comment.id,
    authorName: comment.author?.name || 'Unknown',
    authorId: comment.author_id || null,
    headline: comment.author?.headline || null,
    avatarUrl: comment.author?.avatar_url || null,
    text: comment.text || '',
    timeLabel: formatTimeLabel(comment.created_at),
    liked: Boolean(comment.user_reacted),
    userReacted: comment.user_reacted || null,
    reactionCount: comment.reaction_count ?? 0,
    replyCount: comment.reply_count ?? 0,
    imageUrl: comment.image_url || null,
    myReplies: (comment.my_replies || []).map(mapReplyToView),
  };
}

export function mapGroupToView(
  group: CommentAssistantPostGroupApi
): CommentAssistantPostGroupView {
  const fullText = (group.post_text || group.post_snippet || '').trim();
  return {
    postId: group.post_id,
    socialId: group.social_id,
    postSnippet: group.post_snippet || '',
    postText: fullText,
    comments: group.comments_pending
      ? null
      : (group.comments || []).map(mapCommentToView),
    error: group.error || null,
    hasMoreComments: Boolean(group.has_more_comments),
    commentsCursor: group.comments_cursor || null,
  };
}
