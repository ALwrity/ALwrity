/**
 * Nested reply row with the same react / reply actions as top-level comments.
 */
import React, { useState } from 'react';
import { colors } from '../GrowthEngine/styles';
import { CommentAssistantAttachedImage } from './commentAssistantAttachedImage';
import { COMMENT_ASSISTANT_ACTIONS } from './commentAssistantCopy';
import { CommentAssistantReactionPicker } from './commentAssistantReactionPicker';
import {
  CommentAssistantReplyComposer,
  type CommentAssistantReplyPayload,
} from './commentAssistantReplyComposer';
import type { CommentAssistantReactionType } from './commentAssistantReactions';
import type { CommentAssistantReplyView } from './commentAssistantTypes';

interface CommentAssistantNestedReplyRowProps {
  reply: CommentAssistantReplyView;
  actionsEnabled?: boolean;
  /** @mention target when composing a reply to this nested item. */
  mentionAuthorName: string;
  mentionAuthorId?: string | null;
  onReact?: (replyId: string, reactionType: CommentAssistantReactionType) => void;
  onSendReply?: (replyId: string, payload: CommentAssistantReplyPayload) => void;
}

const actionBtn = (): React.CSSProperties => ({
  padding: '3px 8px',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${colors.border}`,
  background: '#fff',
  color: colors.textSecondary,
});

export const CommentAssistantNestedReplyRow: React.FC<CommentAssistantNestedReplyRowProps> = ({
  reply,
  actionsEnabled = false,
  mentionAuthorName,
  mentionAuthorId,
  onReact,
  onSendReply,
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const busy = Boolean(reply.replyBusy || reply.likeBusy);
  const canAct = actionsEnabled && !busy;
  const nameColor = reply.isMine ? colors.primary : colors.textDark;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: nameColor, marginBottom: 2 }}>
        {reply.authorName}
        {reply.timeLabel ? (
          <span style={{ fontWeight: 400, color: colors.textTertiary }}> · {reply.timeLabel}</span>
        ) : null}
      </div>
      {reply.text ? (
        <div style={{ fontSize: 11, color: colors.textBody, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
          {reply.text}
        </div>
      ) : null}
      {reply.imageUrl ? <CommentAssistantAttachedImage src={reply.imageUrl} /> : null}

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        <CommentAssistantReactionPicker
          disabled={!canAct}
          activeReaction={reply.userReacted}
          reactionCount={reply.reactionCount}
          onReact={(type) => onReact?.(reply.id, type)}
        />
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
      </div>

      {replyOpen && (
        <CommentAssistantReplyComposer
          authorName={mentionAuthorName}
          authorId={mentionAuthorId}
          busy={busy}
          onCancel={() => setReplyOpen(false)}
          onSend={(payload) => {
            onSendReply?.(reply.id, payload);
          }}
        />
      )}
    </div>
  );
};
