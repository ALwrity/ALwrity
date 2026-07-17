/**
 * Comment Assistant inbox — wired to backend inbox / like / reply (Phase 3).
 * Manual tab keeps paste → Generate Reply.
 */
import React from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { colors } from '../GrowthEngine/styles';
import {
  COMMENT_ASSISTANT_COOLDOWN,
  COMMENT_ASSISTANT_EMPTY,
  COMMENT_ASSISTANT_INBOX_HINT,
  COMMENT_ASSISTANT_INTRO,
  COMMENT_ASSISTANT_LOADING,
  COMMENT_ASSISTANT_NOT_CONNECTED,
  COMMENT_ASSISTANT_SYNC,
  COMMENT_ASSISTANT_SYNCING,
  COMMENT_ASSISTANT_TITLE,
} from './commentAssistantCopy';
import { CommentAssistantManualPanel } from './CommentAssistantManualPanel';
import {
  CommentAssistantPostGroup,
  CommentAssistantPostGroupSkeleton,
} from './commentAssistantPostGroup';
import { CommentAssistantPriorityTabs } from './commentAssistantPriorityTabs';
import { useCommentAssistantInbox } from './useCommentAssistantInbox';

export interface CommentAssistantModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
}

export const CommentAssistantInboxModal: React.FC<CommentAssistantModalProps> = ({
  open,
  onClose,
  connected = true,
}) => {
  const {
    tab,
    setTab,
    loadState,
    groups,
    counts,
    error,
    actionError,
    cooldownLeft,
    syncDisabled,
    handleSync,
    retryPost,
    handleLike,
    handleSendReply,
    handleDraftAi,
    handleLoadMore,
  } = useCommentAssistantInbox(open, connected);

  const emptyCopy = tab === 'manual' ? null : COMMENT_ASSISTANT_EMPTY[tab];
  const showGroups =
    connected && loadState === 'ready' && groups.length > 0 && tab !== 'manual';
  const showEmpty =
    connected &&
    loadState === 'ready' &&
    groups.length === 0 &&
    !error &&
    emptyCopy &&
    tab !== 'manual';

  return (
    <DashboardActionModal
      open={open}
      title={COMMENT_ASSISTANT_TITLE}
      onClose={onClose}
      maxWidth={440}
      maxHeight="min(88vh, 520px)"
    >
      <p style={{ margin: '0 0 10px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
        {COMMENT_ASSISTANT_INTRO}
      </p>

      <CommentAssistantPriorityTabs active={tab} onChange={setTab} counts={counts} />

      {tab === 'manual' ? (
        <CommentAssistantManualPanel active={open && tab === 'manual'} onClose={onClose} />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 1.4 }}>
              {COMMENT_ASSISTANT_INBOX_HINT}
            </div>
            <button
              type="button"
              disabled={syncDisabled}
              onClick={handleSync}
              style={{
                flexShrink: 0,
                padding: '5px 10px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: '#fff',
                fontSize: 11,
                fontWeight: 600,
                color: colors.textSecondary,
                cursor: syncDisabled ? 'default' : 'pointer',
                opacity: syncDisabled ? 0.55 : 1,
              }}
            >
              {loadState === 'loading' ? COMMENT_ASSISTANT_SYNCING : COMMENT_ASSISTANT_SYNC}
            </button>
          </div>

          {cooldownLeft > 0 && (
            <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>
              {COMMENT_ASSISTANT_COOLDOWN(cooldownLeft)}
            </div>
          )}

          {(error || actionError) && (
            <div
              style={{
                padding: '10px 12px',
                background: '#fef2f2',
                borderRadius: 8,
                color: '#dc2626',
                fontSize: 12,
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {actionError || error}
            </div>
          )}

          {!connected && (
            <div style={{ textAlign: 'center', padding: '28px 8px' }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.7 }}>🔗</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
                {COMMENT_ASSISTANT_NOT_CONNECTED.title}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
                {COMMENT_ASSISTANT_NOT_CONNECTED.desc}
              </div>
              <button
                type="button"
                onClick={() => setTab('manual')}
                style={{
                  marginTop: 14,
                  padding: '8px 16px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Open Manual
              </button>
            </div>
          )}

          {connected && loadState === 'loading' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    border: '2px solid #d1d5db',
                    borderTopColor: colors.primary,
                    borderRadius: '50%',
                    animation: 'ca-inbox-spin 0.7s linear infinite',
                  }}
                />
                {COMMENT_ASSISTANT_LOADING}
                <style>{`@keyframes ca-inbox-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
              <CommentAssistantPostGroupSkeleton />
              <CommentAssistantPostGroupSkeleton />
            </div>
          )}

          {showEmpty && (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.65 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: colors.textDark, marginBottom: 6 }}>
                {emptyCopy.title}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5, maxWidth: 300, margin: '0 auto 12px' }}>
                {emptyCopy.desc}
              </div>
              <button
                type="button"
                onClick={() => setTab('manual')}
                style={{
                  padding: '7px 14px',
                  background: 'none',
                  border: `1px solid ${colors.primary}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.primary,
                  cursor: 'pointer',
                }}
              >
                Draft with Manual instead
              </button>
            </div>
          )}

          {showGroups && (
            <div>
              {groups.map((g) => (
                <CommentAssistantPostGroup
                  key={g.postId}
                  group={g}
                  actionsEnabled={connected && !g.error}
                  onLike={(commentId) => void handleLike(g.postId, g.socialId, commentId)}
                  onSendReply={(commentId, text) =>
                    void handleSendReply(g.postId, g.socialId, commentId, text)
                  }
                  onDraftAi={(commentId) => {
                    const comment = g.comments?.find((c) => c.id === commentId);
                    if (!comment) return;
                    void handleDraftAi(g.postId, g.postSnippet, commentId, comment.text);
                  }}
                  onRetry={g.error ? () => retryPost() : undefined}
                  onLoadMore={
                    g.hasMoreComments && g.commentsCursor
                      ? () => void handleLoadMore(g.postId, g.socialId, g.commentsCursor!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </DashboardActionModal>
  );
};

/** Backward-compatible export name used by WorkflowActionModals. */
export const CommentAssistantModal = CommentAssistantInboxModal;
