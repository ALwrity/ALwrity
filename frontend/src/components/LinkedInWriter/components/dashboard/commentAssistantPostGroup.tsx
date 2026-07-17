import React, { useMemo, useState } from 'react';
import { colors } from '../GrowthEngine/styles';
import {
  COMMENT_ASSISTANT_ACTIONS,
  COMMENT_ASSISTANT_LOADING_COMMENTS,
} from './commentAssistantCopy';
import { CommentAssistantCommentRow } from './commentAssistantCommentRow';
import type { CommentAssistantPostGroupView } from './commentAssistantTypes';

const VISIBLE_COMMENTS_COLLAPSED = 2;

interface CommentAssistantPostGroupProps {
  group: CommentAssistantPostGroupView;
  /** Accordion: only expanded groups show comment rows. */
  expanded: boolean;
  onToggleExpanded: () => void;
  actionsEnabled?: boolean;
  onLike?: (commentId: string) => void;
  onSendReply?: (commentId: string, text: string) => void;
  onDraftAi?: (commentId: string) => void;
  onRetry?: () => void;
  onLoadMore?: () => void;
  onShowThreadReplies?: (commentId: string) => void;
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
      marginBottom: 8,
      padding: '8px 10px',
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background: '#fafbfc',
    }}
  >
    <SkeletonLine width="72%" />
    <SkeletonLine width="40%" />
  </div>
);

export const CommentAssistantPostGroup: React.FC<CommentAssistantPostGroupProps> = ({
  group,
  expanded,
  onToggleExpanded,
  actionsEnabled,
  onLike,
  onSendReply,
  onDraftAi,
  onRetry,
  onLoadMore,
  onShowThreadReplies,
}) => {
  const [postExpanded, setPostExpanded] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const commentCount = group.comments?.length ?? 0;
  const visibleComments = useMemo(() => {
    if (!group.comments) return [];
    if (showAllComments || commentCount <= VISIBLE_COMMENTS_COLLAPSED) {
      return group.comments;
    }
    return group.comments.slice(0, VISIBLE_COMMENTS_COLLAPSED);
  }, [group.comments, showAllComments, commentCount]);

  const postBody = group.postText || group.postSnippet || 'Your post';
  const canSeeMore = postBody.length > 140 || postBody.split('\n').length > 2;

  return (
    <section
      style={{
        marginBottom: 8,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          background: expanded ? '#f8fafc' : '#fff',
          border: 'none',
          borderBottom: expanded ? `1px solid ${colors.border}` : 'none',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Your post
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {commentCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.primary,
                  background: '#eff6ff',
                  borderRadius: 999,
                  padding: '2px 7px',
                }}
              >
                {commentCount} comment{commentCount === 1 ? '' : 's'}
              </span>
            )}
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              {expanded ? '▾' : '▸'}
            </span>
          </div>
        </div>

        {!expanded && (
          <div
            style={{
              fontSize: 12,
              color: colors.textBody,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {postBody}
          </div>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '8px 10px 6px' }}>
          <div
            style={{
              fontSize: 12,
              color: colors.textBody,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              ...(postExpanded
                ? {}
                : {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }),
            }}
          >
            {postBody}
          </div>
          {canSeeMore && (
            <button
              type="button"
              onClick={() => setPostExpanded((v) => !v)}
              style={{
                marginTop: 4,
                marginBottom: 8,
                padding: '2px 8px',
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: '#f8fafc',
                color: colors.primary,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {postExpanded ? 'See less' : 'See more'}
            </button>
          )}

          {group.error && (
            <div
              style={{
                padding: '8px 10px',
                marginBottom: 8,
                borderRadius: 7,
                background: '#fff7ed',
                color: '#9a3412',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <div style={{ marginBottom: 6 }}>{group.error}</div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 5,
                    border: '1px solid #fdba74',
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
            <div style={{ fontSize: 12, color: colors.textSecondary, padding: '6px 0 10px' }}>
              {COMMENT_ASSISTANT_LOADING_COMMENTS}
            </div>
          )}
          {group.comments && group.comments.length === 0 && !group.error && (
            <div style={{ fontSize: 12, color: colors.textSecondary, padding: '6px 0 10px' }}>
              No comments in this view for this post.
            </div>
          )}

          {visibleComments.map((c) => (
            <CommentAssistantCommentRow
              key={c.id}
              comment={c}
              actionsEnabled={actionsEnabled && !group.error}
              onLike={onLike}
              onSendReply={onSendReply}
              onDraftAi={onDraftAi}
              onShowThreadReplies={onShowThreadReplies}
            />
          ))}

          {commentCount > VISIBLE_COMMENTS_COLLAPSED && (
            <button
              type="button"
              onClick={() => setShowAllComments((v) => !v)}
              style={{
                width: '100%',
                marginBottom: 6,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: '#f8fafc',
                fontSize: 11,
                fontWeight: 600,
                color: colors.primary,
                cursor: 'pointer',
              }}
            >
              {showAllComments
                ? 'Show fewer comments'
                : `Show ${commentCount - VISIBLE_COMMENTS_COLLAPSED} more on this post`}
            </button>
          )}

          {group.hasMoreComments && group.commentsCursor && onLoadMore && showAllComments && (
            <button
              type="button"
              onClick={onLoadMore}
              style={{
                width: '100%',
                marginBottom: 6,
                padding: '6px 8px',
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
      )}
    </section>
  );
};
