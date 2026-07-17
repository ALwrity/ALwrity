/**
 * Comment Assistant inbox shell (Phase 1).
 * Priority tabs + progressive empty/loading states; Manual tab keeps paste → Generate Reply.
 * Real LinkedIn inbox data wires in Phase 3 — no fake production data here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { colors } from '../GrowthEngine/styles';
import {
  COMMENT_ASSISTANT_COOLDOWN,
  COMMENT_ASSISTANT_EMPTY,
  COMMENT_ASSISTANT_INTRO,
  COMMENT_ASSISTANT_LOADING,
  COMMENT_ASSISTANT_NOT_CONNECTED,
  COMMENT_ASSISTANT_PHASE1_NOTE,
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
import type {
  CommentAssistantPostGroupView,
  CommentAssistantTab,
} from './commentAssistantTypes';

const SYNC_COOLDOWN_MS = 30_000;

export interface CommentAssistantModalProps {
  open: boolean;
  onClose: () => void;
  connected?: boolean;
}

type InboxLoadState = 'idle' | 'loading' | 'ready';

export const CommentAssistantInboxModal: React.FC<CommentAssistantModalProps> = ({
  open,
  onClose,
  connected = true,
}) => {
  const [tab, setTab] = useState<CommentAssistantTab>('needs_reply');
  const [loadState, setLoadState] = useState<InboxLoadState>('idle');
  const [groups, setGroups] = useState<CommentAssistantPostGroupView[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const resetInboxShell = useCallback(() => {
    setTab('needs_reply');
    setGroups([]);
    setLoadState('idle');
  }, []);

  /** Progressive skeleton → empty (no fake LinkedIn comments). */
  const runProgressiveEmptyLoad = useCallback(() => {
    setLoadState('loading');
    setGroups([]);
    window.setTimeout(() => {
      setGroups([]);
      setLoadState('ready');
    }, 650);
  }, []);

  useEffect(() => {
    if (!open) {
      resetInboxShell();
      return;
    }
    if (!connected) {
      setLoadState('ready');
      setGroups([]);
      return;
    }
    runProgressiveEmptyLoad();
  }, [open, connected, resetInboxShell, runProgressiveEmptyLoad]);

  useEffect(() => {
    if (!open || cooldownUntil <= 0) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left <= 0) setCooldownUntil(0);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [open, cooldownUntil]);

  const handleSync = () => {
    if (!connected || loadState === 'loading') return;
    if (Date.now() < cooldownUntil) return;
    setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS);
    runProgressiveEmptyLoad();
  };

  const syncDisabled =
    !connected || loadState === 'loading' || cooldownLeft > 0;

  const emptyCopy =
    tab === 'manual'
      ? null
      : COMMENT_ASSISTANT_EMPTY[tab];

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

      <CommentAssistantPriorityTabs active={tab} onChange={setTab} />

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
              {COMMENT_ASSISTANT_PHASE1_NOTE}
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
              {/* Post-group skeletons first; comments fill in once API is wired (Phase 3). */}
              <CommentAssistantPostGroupSkeleton />
              <CommentAssistantPostGroupSkeleton />
            </div>
          )}

          {connected && loadState === 'ready' && groups.length === 0 && emptyCopy && (
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

          {connected && loadState === 'ready' && groups.length > 0 && (
            <div>
              {groups.map((g) => (
                <CommentAssistantPostGroup key={g.postId} group={g} actionsEnabled={false} />
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
