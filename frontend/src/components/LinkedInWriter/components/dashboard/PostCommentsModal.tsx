/**
 * Post Comments modal — list, paginate, and reply to LinkedIn post comments.
 * Reply composer appears inline under the selected comment.
 */
import React from 'react';

import { DashboardActionModal } from './DashboardActionModal';
import type { PostDelta } from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { CommentsSkeleton, PostCommentCard } from './PostCommentCard';
import {
  POST_COMMENTS_LIST_MIN_HEIGHT,
  POST_COMMENTS_MODAL_SIZE,
  POST_COMMENTS_MODAL_Z_INDEX,
} from './postCommentsModalLayout';
import { usePostCommentsModal } from './usePostCommentsModal';

export interface PostCommentsModalProps {
  open: boolean;
  post: PostDelta | null;
  connected?: boolean;
  onClose: () => void;
}

const actionButtonStyle = (enabled: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  background: enabled ? colors.primary : '#d1d5db',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.7,
});

export const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  open,
  post,
  connected = true,
  onClose,
}) => {
  const {
    comments,
    hasMore,
    loading,
    loadingMore,
    refreshing,
    error,
    replyText,
    setReplyText,
    selectedCommentId,
    selectCommentForReply,
    cancelReply,
    replying,
    replyError,
    replySuccess,
    canReply,
    loadComments,
    loadMoreComments,
    refreshComments,
    handleReply,
  } = usePostCommentsModal({ open, post, connected });

  if (!open || !post) return null;

  const listBusy = loading || refreshing;

  return (
    <DashboardActionModal
      open={open}
      title="Post Comments"
      onClose={onClose}
      zIndex={POST_COMMENTS_MODAL_Z_INDEX}
      {...POST_COMMENTS_MODAL_SIZE}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 10,
            background: colors.rowBg,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 12,
            color: colors.textSecondary,
            lineHeight: 1.45,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, color: colors.textDark, marginBottom: 4 }}>Post</div>
          {post.text ? `${post.text.slice(0, 160)}${post.text.length > 160 ? '…' : ''}` : '(no text)'}
          {post.comments_delta > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              +{post.comments_delta} new comment{post.comments_delta === 1 ? '' : 's'} since last sync
            </div>
          )}
        </div>

        <div
          style={{
            flex: '1 1 auto',
            minHeight: POST_COMMENTS_LIST_MIN_HEIGHT,
            overflowY: 'auto',
            marginBottom: 10,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            background: '#fff',
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                Loading comments from LinkedIn…
              </div>
              <CommentsSkeleton />
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: '16px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                fontSize: 13,
                color: '#dc2626',
                lineHeight: 1.5,
              }}
            >
              {error}
              <button
                type="button"
                onClick={() => void loadComments()}
                style={{ ...actionButtonStyle(true), display: 'block', marginTop: 10 }}
              >
                🔁 Retry
              </button>
            </div>
          )}

          {!listBusy && !error && comments.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                color: colors.textSecondary,
                fontSize: 13,
              }}
            >
              No comments found on this post.
            </div>
          )}

          {!loading && !error && comments.length > 0 && (
            <div style={{ opacity: refreshing ? 0.6 : 1 }}>
              {refreshing && (
                <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>
                  Refreshing comments…
                </div>
              )}
              {comments.map((c) => (
                <PostCommentCard
                  key={c.id}
                  comment={c}
                  selected={selectedCommentId === c.id}
                  onSelectReply={selectCommentForReply}
                  replyText={selectedCommentId === c.id ? replyText : ''}
                  onReplyTextChange={setReplyText}
                  onSendReply={() => void handleReply()}
                  onCancelReply={cancelReply}
                  canSendReply={canReply}
                  sendingReply={replying}
                  replyDisabled={!connected || loading}
                  replyError={selectedCommentId === c.id ? replyError : undefined}
                />
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadMoreComments()}
                  disabled={loadingMore || refreshing}
                  style={{
                    ...actionButtonStyle(!loadingMore && !refreshing),
                    width: '100%',
                    marginTop: 4,
                    padding: '8px 12px',
                  }}
                >
                  {loadingMore ? 'Loading more…' : 'Load more comments'}
                </button>
              )}
            </div>
          )}
        </div>

        {replySuccess && (
          <div
            style={{
              flexShrink: 0,
              fontSize: 12,
              color: '#16a34a',
              padding: '8px 10px',
              background: '#f0fdf4',
              borderRadius: 6,
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span>Reply posted on LinkedIn.</span>
            <button
              type="button"
              onClick={() => void refreshComments()}
              disabled={refreshing}
              style={actionButtonStyle(!refreshing)}
            >
              {refreshing ? 'Refreshing…' : 'Refresh comments'}
            </button>
          </div>
        )}
      </div>
    </DashboardActionModal>
  );
};
