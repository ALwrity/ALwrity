import React, { useEffect, useState } from 'react';
import { colors } from '../GrowthEngine/styles';
import { CommentAssistantAuthorRow } from './commentAssistantAuthorRow';
import { COMMENT_ASSISTANT_ACTIONS } from './commentAssistantCopy';
import type { CommentAssistantCommentView } from './commentAssistantTypes';

interface CommentAssistantCommentRowProps {
  comment: CommentAssistantCommentView;
  actionsEnabled?: boolean;
  onLike?: (commentId: string) => void;
  onSendReply?: (commentId: string, text: string) => void;
  onDraftAi?: (commentId: string) => void;
  onShowThreadReplies?: (commentId: string) => void;
}

const actionBtn = (primary?: boolean): React.CSSProperties => ({
  padding: '3px 8px',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  border: primary ? 'none' : `1px solid ${colors.border}`,
  background: primary ? colors.primary : '#fff',
  color: primary ? '#fff' : colors.textSecondary,
});

export const CommentAssistantCommentRow: React.FC<CommentAssistantCommentRowProps> = ({
  comment,
  actionsEnabled = false,
  onLike,
  onSendReply,
  onDraftAi,
  onShowThreadReplies,
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [repliesOpen, setRepliesOpen] = useState(Boolean(comment.myReplies?.length));

  useEffect(() => {
    if (comment.draftText != null && comment.draftText !== '') {
      setReplyText(comment.draftText);
      setReplyOpen(true);
    }
  }, [comment.draftText]);

  useEffect(() => {
    if (comment.myReplies && comment.myReplies.length > 0) {
      setRepliesOpen(true);
    }
  }, [comment.myReplies]);

  const busy = Boolean(comment.replyBusy || comment.draftBusy || comment.likeBusy);
  const canAct = actionsEnabled && !busy;
  const myReplies = comment.myReplies || [];
  const replyCount = comment.replyCount ?? 0;

  const handleSend = () => {
    const text = replyText.trim();
    if (!text || !onSendReply || busy) return;
    onSendReply(comment.id, text);
  };

  return (
    <div
      style={{
        marginBottom: 6,
        padding: '8px 10px',
        borderRadius: 7,
        border: `1px solid ${colors.border}`,
        background: '#fff',
      }}
    >
      <CommentAssistantAuthorRow
        name={comment.authorName}
        headline={comment.headline}
        avatarUrl={comment.avatarUrl}
        timeLabel={comment.timeLabel}
        size={28}
      />

      <div
        style={{
          fontSize: 12,
          color: colors.textBody,
          lineHeight: 1.45,
          marginTop: 6,
          marginBottom: 6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {comment.text}
      </div>

      {myReplies.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => setRepliesOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 11,
              fontWeight: 700,
              color: colors.primary,
              cursor: 'pointer',
            }}
          >
            {repliesOpen
              ? myReplies.length > 1
                ? 'Hide your replies'
                : 'Hide your reply'
              : myReplies.length > 1
                ? `Your replies (${myReplies.length})`
                : 'Your reply'}
          </button>
          {repliesOpen && (
            <div
              style={{
                marginTop: 6,
                marginLeft: 4,
                paddingLeft: 10,
                borderLeft: `2px solid ${colors.primary}`,
              }}
            >
              {myReplies.map((r) => (
                <div key={r.id} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: colors.primary, marginBottom: 2 }}>
                    {r.authorName}
                    {r.timeLabel ? (
                      <span style={{ fontWeight: 400, color: colors.textTertiary }}> · {r.timeLabel}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textBody, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {r.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {replyCount > 0 && onShowThreadReplies && !comment.threadReplies && (
        <button
          type="button"
          onClick={() => onShowThreadReplies(comment.id)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginBottom: 6,
            fontSize: 11,
            fontWeight: 600,
            color: colors.primary,
            cursor: 'pointer',
          }}
        >
          Show all replies ({replyCount})
        </button>
      )}

      {comment.threadReplies && comment.threadReplies.length > 0 && (
        <div
          style={{
            marginBottom: 6,
            marginLeft: 4,
            paddingLeft: 10,
            borderLeft: `2px solid ${colors.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, marginBottom: 4 }}>
            Thread replies
          </div>
          {comment.threadReplies.map((r) => (
            <div key={r.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.textDark }}>
                {r.authorName}
                {r.timeLabel ? (
                  <span style={{ fontWeight: 400, color: colors.textTertiary }}> · {r.timeLabel}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: colors.textBody, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {r.text}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!canAct || comment.liked}
          onClick={() => onLike?.(comment.id)}
          style={{
            ...actionBtn(),
            opacity: canAct || comment.liked ? 1 : 0.55,
            cursor: canAct && !comment.liked ? 'pointer' : 'default',
            color: comment.liked ? '#0a66c2' : colors.textSecondary,
          }}
        >
          {comment.likeBusy
            ? '…'
            : comment.liked
              ? COMMENT_ASSISTANT_ACTIONS.liked
              : COMMENT_ASSISTANT_ACTIONS.like}
        </button>
        <button
          type="button"
          disabled={!canAct}
          onClick={() => setReplyOpen((v) => !v)}
          style={{
            ...actionBtn(),
            opacity: canAct ? 1 : 0.55,
            cursor: canAct ? 'pointer' : 'default',
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.reply}
        </button>
        <button
          type="button"
          disabled={!canAct}
          onClick={() => onDraftAi?.(comment.id)}
          style={{
            ...actionBtn(true),
            opacity: canAct ? 1 : 0.55,
            cursor: canAct ? 'pointer' : 'default',
          }}
        >
          {comment.draftBusy
            ? COMMENT_ASSISTANT_ACTIONS.drafting
            : COMMENT_ASSISTANT_ACTIONS.draftAi}
        </button>
      </div>

      {replyOpen && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a short reply…"
            rows={2}
            disabled={busy}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 9px',
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              fontFamily: 'inherit',
              lineHeight: 1.45,
              resize: 'vertical',
              color: colors.textBody,
              marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              disabled={!replyText.trim() || busy || !actionsEnabled}
              onClick={handleSend}
              style={{
                ...actionBtn(true),
                opacity: replyText.trim() && !busy && actionsEnabled ? 1 : 0.5,
              }}
            >
              {comment.replyBusy
                ? COMMENT_ASSISTANT_ACTIONS.sending
                : COMMENT_ASSISTANT_ACTIONS.send}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setReplyOpen(false); setReplyText(''); }}
              style={actionBtn()}
            >
              {COMMENT_ASSISTANT_ACTIONS.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
