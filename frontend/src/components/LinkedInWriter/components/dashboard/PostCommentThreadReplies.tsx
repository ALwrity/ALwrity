import React from 'react';

import { colors } from '../GrowthEngine/styles';
import { formatLocalizedRelativeTime } from './engagementTrendsLocaleFormat';
import type { PostComment } from './postCommentsTypes';
import {
  formatReactionCountLabel,
  formatReplyCountLabel,
} from './postCommentsTypes';

export interface PostCommentEngagementMetaProps {
  comment: PostComment;
  compact?: boolean;
}

/** Relative time + reactions / impressions / your reaction. */
export const PostCommentEngagementMeta: React.FC<PostCommentEngagementMetaProps> = ({
  comment,
  compact = false,
}) => {
  const parts: string[] = [];
  parts.push(comment.created_at ? formatLocalizedRelativeTime(comment.created_at) : 'Unknown time');
  if (comment.reaction_count > 0) {
    parts.push(formatReactionCountLabel(comment.reaction_count));
  }
  if ((comment.impressions_count ?? 0) > 0) {
    parts.push(
      comment.impressions_count === 1
        ? '1 impression'
        : `${comment.impressions_count} impressions`
    );
  }
  if (!compact && comment.reply_count > 0) {
    parts.push(formatReplyCountLabel(comment.reply_count));
  }

  return (
    <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: compact ? 4 : 6 }}>
      {parts.join(' · ')}
      {comment.user_reacted && (
        <span style={{ marginLeft: 6, color: colors.primary, fontWeight: 600 }}>
          · You reacted ({comment.user_reacted})
        </span>
      )}
    </div>
  );
};

export interface PostCommentThreadRepliesProps {
  parentId: string;
  replyCount: number;
  expanded: boolean;
  loading: boolean;
  error?: string;
  replies: PostComment[];
  onToggle: () => void;
  onRetry: () => void;
}

/**
 * Expandable nested replies under a parent comment (LinkedIn-style indent).
 */
export const PostCommentThreadReplies: React.FC<PostCommentThreadRepliesProps> = ({
  replyCount,
  expanded,
  loading,
  error,
  replies,
  onToggle,
  onRetry,
}) => {
  if (replyCount <= 0 && replies.length === 0) return null;

  const countLabel = formatReplyCountLabel(Math.max(replyCount, replies.length));

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.primary,
          fontSize: 12,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          padding: 0,
        }}
      >
        {loading
          ? 'Loading replies…'
          : expanded
            ? `Hide ${countLabel}`
            : `Show ${countLabel}`}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${colors.border}` }}>
          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>
              {error}
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'block',
                  marginTop: 6,
                  padding: '4px 10px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!error && !loading && replies.length === 0 && (
            <div style={{ fontSize: 12, color: colors.textTertiary }}>No replies found.</div>
          )}

          {replies.map((reply) => (
            <div
              key={reply.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              {reply.author.avatar_url ? (
                <img
                  src={reply.author.avatar_url}
                  alt=""
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#e5e7eb',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: colors.textTertiary,
                  }}
                >
                  {(reply.author.name || '?')[0]}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.textDark }}>
                  {reply.author.name || 'Unknown'}
                  {reply.author.headline && (
                    <span style={{ fontWeight: 400, color: colors.textTertiary }}>
                      {' '}
                      · {reply.author.headline}
                    </span>
                  )}
                </div>
                <PostCommentEngagementMeta comment={reply} compact />
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {reply.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
