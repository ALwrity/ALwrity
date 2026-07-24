import React, { useEffect, useRef, useState } from "react";
import { colors } from "../GrowthEngine/styles";
import { CommentAssistantAttachedImage } from "./commentAssistantAttachedImage";
import { CommentAssistantAuthorRow } from "./commentAssistantAuthorRow";
import {
  COMMENT_ASSISTANT_ACTIONS,
  COMMENT_ASSISTANT_DRAFT_PROGRESS,
} from "./commentAssistantCopy";
import { CommentAssistantNestedReplyRow } from "./commentAssistantNestedReplyRow";
import { CommentAssistantReactionPicker } from "./commentAssistantReactionPicker";
import { CommentAssistantSpinner } from "./commentAssistantSpinner";
import {
  CommentAssistantReplyComposer,
  type CommentAssistantReplyPayload,
} from "./commentAssistantReplyComposer";
import type { CommentAssistantReactionType } from "./commentAssistantReactions";
import type { CommentAssistantCommentView } from "./commentAssistantTypes";

interface CommentAssistantCommentRowProps {
  comment: CommentAssistantCommentView;
  actionsEnabled?: boolean;
  onReact?: (
    commentId: string,
    reactionType: CommentAssistantReactionType,
  ) => void;
  onSendReply?: (
    commentId: string,
    payload: CommentAssistantReplyPayload,
  ) => void;
  onDraftAlwrity?: (commentId: string) => void;
  onShowThreadReplies?: (commentId: string) => void;
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

export const CommentAssistantCommentRow: React.FC<
  CommentAssistantCommentRowProps
> = ({
  comment,
  actionsEnabled = false,
  onReact,
  onSendReply,
  onDraftAlwrity,
  onShowThreadReplies,
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(
    Boolean(comment.myReplies?.length),
  );
  const prevDraftTextRef = useRef(comment.draftText);

  useEffect(() => {
    if (comment.draftText != null && comment.draftText !== "") {
      setReplyOpen(true);
    }
    // Close the composer when the draft has been sent/cleared.
    if (
      prevDraftTextRef.current &&
      prevDraftTextRef.current !== "" &&
      !comment.draftText
    ) {
      setReplyOpen(false);
    }
    prevDraftTextRef.current = comment.draftText;
  }, [comment.draftText]);

  useEffect(() => {
    if (comment.myReplies && comment.myReplies.length > 0) {
      setRepliesOpen(true);
    }
  }, [comment.myReplies]);

  const busy = Boolean(
    comment.replyBusy || comment.draftBusy || comment.likeBusy,
  );
  const canAct = actionsEnabled && !busy;
  const myReplies = comment.myReplies || [];
  const myReplyIds = new Set(myReplies.map((r) => r.id));
  // Avoid showing the same reply twice when a posted reply also appears in thread replies.
  const threadReplies = (comment.threadReplies || []).filter(
    (r) => !myReplyIds.has(r.id),
  );
  const replyCount = comment.replyCount ?? 0;

  /** When replying under own reply, keep @mention on the audience author. */
  const parentMentionName = comment.authorName;
  const parentMentionId = comment.authorId;

  return (
    <div
      style={{
        marginBottom: 6,
        padding: "8px 10px",
        borderRadius: 7,
        border: `1px solid ${colors.border}`,
        background: "#fff",
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
          whiteSpace: "pre-wrap",
        }}
      >
        {comment.text}
      </div>
      {comment.imageUrl ? (
        <CommentAssistantAttachedImage src={comment.imageUrl} />
      ) : null}

      {myReplies.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => setRepliesOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 11,
              fontWeight: 700,
              color: colors.primary,
              cursor: "pointer",
            }}
          >
            {repliesOpen
              ? myReplies.length > 1
                ? "Hide your replies"
                : "Hide your reply"
              : myReplies.length > 1
                ? `Your replies (${myReplies.length})`
                : "Your reply"}
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
                <CommentAssistantNestedReplyRow
                  key={r.id}
                  reply={r}
                  actionsEnabled={actionsEnabled}
                  mentionAuthorName={parentMentionName}
                  mentionAuthorId={parentMentionId}
                  onReact={onReact}
                  onSendReply={onSendReply}
                  onDraftAlwrity={onDraftAlwrity}
                />
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
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: 6,
            fontSize: 11,
            fontWeight: 600,
            color: colors.primary,
            cursor: "pointer",
          }}
        >
          Show all replies ({replyCount})
        </button>
      )}

      {threadReplies.length > 0 && (
        <div
          style={{
            marginBottom: 6,
            marginLeft: 4,
            paddingLeft: 10,
            borderLeft: `2px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textTertiary,
              marginBottom: 4,
            }}
          >
            Thread replies
          </div>
          {threadReplies.map((r) => (
            <CommentAssistantNestedReplyRow
              key={r.id}
              reply={r}
              actionsEnabled={actionsEnabled}
              mentionAuthorName={r.isMine ? parentMentionName : r.authorName}
              mentionAuthorId={r.isMine ? parentMentionId : r.authorId}
              onReact={onReact}
              onSendReply={onSendReply}
              onDraftAlwrity={onDraftAlwrity}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <CommentAssistantReactionPicker
          disabled={!canAct}
          activeReaction={comment.userReacted}
          reactionCount={comment.reactionCount}
          onReact={(type) => onReact?.(comment.id, type)}
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
          aria-busy={comment.draftBusy}
          onClick={() => onDraftAlwrity?.(comment.id)}
          style={{
            ...actionBtn(true),
            display: "flex",
            alignItems: "center",
            gap: 5,
            opacity: canAct ? 1 : 0.55,
            cursor: canAct ? "pointer" : "default",
          }}
        >
          {comment.draftBusy ? (
            <>
              <CommentAssistantSpinner size={12} color="#fff" />
              {COMMENT_ASSISTANT_ACTIONS.drafting}
            </>
          ) : (
            COMMENT_ASSISTANT_ACTIONS.draftAlwrity
          )}
        </button>
      </div>

      {comment.draftBusy ? (
        <div
          style={{
            fontSize: 10,
            color: colors.primary,
            marginTop: 4,
            marginBottom: 2,
            fontWeight: 600,
          }}
        >
          {COMMENT_ASSISTANT_DRAFT_PROGRESS}
        </div>
      ) : null}

      {comment.draftText && !comment.draftBusy ? (
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
          authorName={comment.authorName}
          authorId={comment.authorId}
          initialText={comment.draftText || undefined}
          busy={busy}
          onCancel={() => setReplyOpen(false)}
          onSend={(payload) => {
            onSendReply?.(comment.id, payload);
          }}
        />
      )}
    </div>
  );
};
