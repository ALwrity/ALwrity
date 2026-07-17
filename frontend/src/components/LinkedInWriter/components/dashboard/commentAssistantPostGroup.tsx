import React from 'react';
import { colors } from '../GrowthEngine/styles';
import {
  COMMENT_ASSISTANT_ACTIONS,
  COMMENT_ASSISTANT_LOADING_COMMENTS,
} from './commentAssistantCopy';
import { CommentAssistantCommentRow } from './commentAssistantCommentRow';
import type { CommentAssistantPostGroupView } from './commentAssistantTypes';

interface CommentAssistantPostGroupProps {
  group: CommentAssistantPostGroupView;
  actionsEnabled?: boolean;
  onLike?: (commentId: string) => void;
  onSendReply?: (commentId: string, text: string) => void;
  onDraftAi?: (commentId: string) => void;
  onRetry?: () => void;
  onLoadMore?: () => void;
}

const SkeletonLine: React.FC<{ width: string }> = ({ width }) => (
  <div
    style={{
      height: 10,
      width,
      borderRadius: 4,
      background: 'linear-gradient(90deg, #eef2f6 0%, #f8fafc 50%, #eef2f6 100%)',
      marginBottom: 8,
    }}
  />
);

export const CommentAssistantPostGroupSkeleton: React.FC = () => (
  <div
    style={{
      marginBottom: 12,
      padding: '10px 12px',
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background: '#fafbfc',
    }}
  >
    <SkeletonLine width="72%" />
    <SkeletonLine width="48%" />
    <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: `2px solid ${colors.border}` }}>
      <SkeletonLine width="90%" />
      <SkeletonLine width="60%" />
    </div>
  </div>
);

export const CommentAssistantPostGroup: React.FC<CommentAssistantPostGroupProps> = ({
  group,
  actionsEnabled,
  onLike,
  onSendReply,
  onDraftAi,
  onRetry,
  onLoadMore,
}) => (
  <section
    style={{
      marginBottom: 12,
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      overflow: 'hidden',
      background: '#fff',
    }}
  >
    <header
      style={{
        padding: '8px 12px',
        background: '#f8fafc',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Your post
      </div>
      <div
        style={{
          fontSize: 12,
          color: colors.textBody,
          lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {group.postSnippet || 'Your post'}
      </div>
    </header>

    <div style={{ padding: '8px 10px 4px' }}>
      {group.error && (
        <div
          style={{
            padding: '10px 12px',
            marginBottom: 8,
            borderRadius: 7,
            background: '#fff7ed',
            color: '#9a3412',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ marginBottom: 8 }}>{group.error}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: '5px 10px',
                borderRadius: 5,
                border: `1px solid #fdba74`,
                background: '#fff',
                fontSize: 11,
                fontWeight: 600,
                color: '#9a3412',
                cursor: 'pointer',
              }}
            >
              {COMMENT_ASSISTANT_ACTIONS.retryPost}
            </button>
          )}
        </div>
      )}

      {group.comments === null && (
        <div style={{ fontSize: 12, color: colors.textSecondary, padding: '8px 4px 12px' }}>
          {COMMENT_ASSISTANT_LOADING_COMMENTS}
        </div>
      )}
      {group.comments && group.comments.length === 0 && !group.error && (
        <div style={{ fontSize: 12, color: colors.textSecondary, padding: '8px 4px 12px' }}>
          No comments in this view for this post.
        </div>
      )}
      {group.comments?.map((c) => (
        <CommentAssistantCommentRow
          key={c.id}
          comment={c}
          actionsEnabled={actionsEnabled && !group.error}
          onLike={onLike}
          onSendReply={onSendReply}
          onDraftAi={onDraftAi}
        />
      ))}

      {group.hasMoreComments && group.commentsCursor && onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          style={{
            width: '100%',
            margin: '4px 0 10px',
            padding: '7px 10px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            background: '#fff',
            fontSize: 11,
            fontWeight: 600,
            color: colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.loadMore}
        </button>
      )}
    </div>
  </section>
);
