import React from 'react';

import { colors } from '../GrowthEngine/styles';
import { PostCommentEngagementMeta, PostCommentThreadReplies } from './PostCommentThreadReplies';
import { PostCommentInlineReply } from './PostCommentInlineReply';
import type { PostComment } from './postCommentsTypes';

export interface PostCommentCardProps {
  comment: PostComment;
  selected: boolean;
  onSelectReply: (commentId: string) => void;
  replyText?: string;
  onReplyTextChange?: (value: string) => void;
  onSendReply?: () => void;
  onCancelReply?: () => void;
  canSendReply?: boolean;
  sendingReply?: boolean;
  replyDisabled?: boolean;
  replyError?: string;
  /** Nested replies under this comment. */
  nestedReplies?: PostComment[];
  repliesExpanded?: boolean;
  repliesLoading?: boolean;
  repliesError?: string;
  onToggleReplies?: () => void;
  onRetryReplies?: () => void;
}

export const PostCommentCard: React.FC<PostCommentCardProps> = ({
  comment,
  selected,
  onSelectReply,
  replyText = '',
  onReplyTextChange,
  onSendReply,
  onCancelReply,
  canSendReply = false,
  sendingReply = false,
  replyDisabled = false,
  replyError,
  nestedReplies = [],
  repliesExpanded = false,
  repliesLoading = false,
  repliesError,
  onToggleReplies,
  onRetryReplies,
}) => (
  <div
    style={{
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
      border: `1px solid ${selected ? colors.primary : colors.border}`,
      background: selected ? '#eff6ff' : colors.rowBg,
    }}
  >
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {comment.author.avatar_url ? (
        <img
          src={comment.author.avatar_url}
          alt=""
          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#e5e7eb',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: colors.textTertiary,
          }}
        >
          {(comment.author.name || '?')[0]}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textDark, marginBottom: 2 }}>
          {comment.author.name || 'Unknown'}
          {comment.author.headline && (
            <span style={{ fontWeight: 400, color: colors.textTertiary }}>
              {' '}
              · {comment.author.headline}
            </span>
          )}
        </div>
        <PostCommentEngagementMeta comment={comment} />
        <div
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {comment.text}
        </div>

        {!selected && (
          <button
            type="button"
            onClick={() => onSelectReply(comment.id)}
            style={{
              marginTop: 8,
              padding: '4px 10px',
              background: 'transparent',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reply
          </button>
        )}

        {selected && onReplyTextChange && onSendReply && onCancelReply && (
          <PostCommentInlineReply
            replyText={replyText}
            onReplyTextChange={onReplyTextChange}
            onSend={onSendReply}
            onCancel={onCancelReply}
            canSend={canSendReply}
            sending={sendingReply}
            disabled={replyDisabled}
            error={replyError}
          />
        )}

        {onToggleReplies && onRetryReplies && (
          <PostCommentThreadReplies
            parentId={comment.id}
            replyCount={comment.reply_count}
            expanded={repliesExpanded}
            loading={repliesLoading}
            error={repliesError}
            replies={nestedReplies}
            onToggle={onToggleReplies}
            onRetry={onRetryReplies}
          />
        )}
      </div>
    </div>
  </div>
);

export const CommentsSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        style={{
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: colors.rowBg,
          height: 72,
          opacity: 0.6,
        }}
      />
    ))}
  </div>
);
