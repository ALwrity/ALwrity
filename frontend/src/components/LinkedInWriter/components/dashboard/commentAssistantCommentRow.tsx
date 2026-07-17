import React, { useState } from 'react';
import { colors, rowBase } from '../GrowthEngine/styles';
import { COMMENT_ASSISTANT_ACTIONS } from './commentAssistantCopy';
import type { CommentAssistantCommentView } from './commentAssistantTypes';

interface CommentAssistantCommentRowProps {
  comment: CommentAssistantCommentView;
  /** Phase 1: actions are UI-only until Phase 3 wires APIs. */
  actionsEnabled?: boolean;
  onLike?: (commentId: string) => void;
  onSendReply?: (commentId: string, text: string) => void;
  onDraftAi?: (commentId: string) => void;
}

const actionBtn = (primary?: boolean): React.CSSProperties => ({
  padding: '4px 10px',
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
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    const text = replyText.trim();
    if (!text || !onSendReply) return;
    onSendReply(comment.id, text);
    setReplyText('');
    setReplyOpen(false);
  };

  return (
    <div style={{ ...rowBase, marginBottom: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: colors.textDark }}>{comment.authorName}</div>
        <div style={{ fontSize: 11, color: colors.textTertiary, flexShrink: 0 }}>{comment.timeLabel}</div>
      </div>
      <div style={{ fontSize: 12, color: colors.textBody, lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
        {comment.text}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!actionsEnabled}
          title={!actionsEnabled ? COMMENT_ASSISTANT_ACTIONS.comingSoon : undefined}
          onClick={() => onLike?.(comment.id)}
          style={{
            ...actionBtn(),
            opacity: actionsEnabled ? 1 : 0.55,
            cursor: actionsEnabled ? 'pointer' : 'default',
            color: comment.liked ? '#0a66c2' : colors.textSecondary,
          }}
        >
          {comment.liked ? COMMENT_ASSISTANT_ACTIONS.liked : COMMENT_ASSISTANT_ACTIONS.like}
        </button>
        <button
          type="button"
          disabled={!actionsEnabled}
          title={!actionsEnabled ? COMMENT_ASSISTANT_ACTIONS.comingSoon : undefined}
          onClick={() => setReplyOpen((v) => !v)}
          style={{
            ...actionBtn(),
            opacity: actionsEnabled ? 1 : 0.55,
            cursor: actionsEnabled ? 'pointer' : 'default',
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.reply}
        </button>
        <button
          type="button"
          disabled={!actionsEnabled}
          title={!actionsEnabled ? COMMENT_ASSISTANT_ACTIONS.comingSoon : undefined}
          onClick={() => onDraftAi?.(comment.id)}
          style={{
            ...actionBtn(true),
            opacity: actionsEnabled ? 1 : 0.55,
            cursor: actionsEnabled ? 'pointer' : 'default',
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.draftAi}
        </button>
      </div>

      {replyOpen && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a short reply…"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 7,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
              color: colors.textBody,
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={!replyText.trim() || !actionsEnabled}
              onClick={handleSend}
              style={{
                ...actionBtn(true),
                opacity: replyText.trim() && actionsEnabled ? 1 : 0.5,
              }}
            >
              {COMMENT_ASSISTANT_ACTIONS.send}
            </button>
            <button
              type="button"
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
