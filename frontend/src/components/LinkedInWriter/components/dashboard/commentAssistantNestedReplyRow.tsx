/**
 * Nested reply row with the same react / reply actions as top-level comments.
 */
import React, { useEffect, useRef, useState } from "react";
import { colors } from "../GrowthEngine/styles";
import { CommentAssistantAttachedImage } from "./commentAssistantAttachedImage";
import { COMMENT_ASSISTANT_ACTIONS } from "./commentAssistantCopy";
import { CommentAssistantReactionPicker } from "./commentAssistantReactionPicker";
import { CommentAssistantSpinner } from "./commentAssistantSpinner";
import {
  CommentAssistantReplyComposer,
  type CommentAssistantReplyPayload,
} from "./commentAssistantReplyComposer";
import type { CommentAssistantReactionType } from "./commentAssistantReactions";
import type { CommentAssistantReplyView } from "./commentAssistantTypes";

interface CommentAssistantNestedReplyRowProps {
  reply: CommentAssistantReplyView;
  actionsEnabled?: boolean;
  /** @mention target when composing a reply to this nested item. */
  mentionAuthorName: string;
  mentionAuthorId?: string | null;
  onReact?: (
    replyId: string,
    reactionType: CommentAssistantReactionType,
  ) => void;
  onSendReply?: (
    replyId: string,
    payload: CommentAssistantReplyPayload,
  ) => void;
  onDraftAlwrity?: (replyId: string) => void;
}

const actionBtn = (primary?: boolean): React.CSSProperties => ({
  padding: "3px 8px",
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  border: primary ? "none" : `1px solid ${colors.border}`,
  background: primary ? colors.primary : "#fff",
  color: primary ? "#fff" : colors.textSecondary,
});

export const CommentAssistantNestedReplyRow: React.FC<
  CommentAssistantNestedReplyRowProps
> = ({
  reply,
  actionsEnabled = false,
  mentionAuthorName,
  mentionAuthorId,
  onReact,
  onSendReply,
  onDraftAlwrity,
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const prevDraftTextRef = useRef(reply.draftText);
  const busy = Boolean(reply.replyBusy || reply.draftBusy || reply.likeBusy);
  const canAct = actionsEnabled && !busy;

  useEffect(() => {
    if (reply.draftText != null && reply.draftText !== "") {
      setReplyOpen(true);
    }
    if (
      prevDraftTextRef.current &&
      prevDraftTextRef.current !== "" &&
      !reply.draftText
    ) {
      setReplyOpen(false);
    }
    prevDraftTextRef.current = reply.draftText;
  }, [reply.draftText]);
  const nameColor = reply.isMine ? colors.primary : colors.textDark;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: nameColor,
          marginBottom: 2,
        }}
      >
        {reply.authorName}
        {reply.timeLabel ? (
          <span style={{ fontWeight: 400, color: colors.textTertiary }}>
            {" "}
            · {reply.timeLabel}
          </span>
        ) : null}
      </div>
      {reply.text ? (
        <div
          style={{
            fontSize: 11,
            color: colors.textBody,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {reply.text}
        </div>
      ) : null}
      {reply.imageUrl ? (
        <CommentAssistantAttachedImage src={reply.imageUrl} />
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
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
            cursor: canAct ? "pointer" : "default",
          }}
        >
          {COMMENT_ASSISTANT_ACTIONS.reply}
        </button>
        <button
          type="button"
          disabled={!canAct}
          aria-label="Draft a reply with ALwrity"
          aria-busy={reply.draftBusy}
          onClick={() => onDraftAlwrity?.(reply.id)}
          style={{
            ...actionBtn(true),
            display: "flex",
            alignItems: "center",
            gap: 5,
            opacity: canAct ? 1 : 0.55,
            cursor: canAct ? "pointer" : "default",
          }}
        >
          {reply.draftBusy ? (
            <>
              <CommentAssistantSpinner size={11} color="#fff" />
              {COMMENT_ASSISTANT_ACTIONS.drafting}
            </>
          ) : (
            COMMENT_ASSISTANT_ACTIONS.draftAlwrity
          )}
        </button>
      </div>

      {reply.draftText ? (
        <div
          style={{
            fontSize: 10,
            color: colors.textTertiary,
            marginTop: 4,
            marginBottom: 2,
          }}
        >
          Review and edit the draft before sending.
        </div>
      ) : null}

      {replyOpen && (
        <CommentAssistantReplyComposer
          authorName={mentionAuthorName}
          authorId={mentionAuthorId}
          initialText={reply.draftText || undefined}
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
