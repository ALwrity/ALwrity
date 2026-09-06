import React from "react";
import type { YouTubeInboxComment } from "./youtubeCommentVideoGroups";
import { YouTubeCommentThreadReplies } from "./YouTubeCommentThreadReplies";
import { YouTubeCommentActionProgressPanel } from "./YouTubeCommentActionProgressPanel";
import { YouTubeCommentLikeCount } from "./YouTubeCommentLikeCount";
import type { YouTubeCommentParentBusyAction } from "./youtubeCommentActionLoader";

export const YouTubeCommentInboxRow: React.FC<{
  comment: YouTubeInboxComment;
  draftText: string;
  busy: boolean;
  busyAction?: YouTubeCommentParentBusyAction | null;
  onDraftChange: (value: string) => void;
  onDraft: () => void;
  onSend: () => void;
  onCancelDraft: () => void;
}> = ({
  comment,
  draftText,
  busy,
  busyAction,
  onDraftChange,
  onDraft,
  onSend,
  onCancelDraft,
}) => {
  const commentId = comment.comment_id || "";
  const canCancelDraft =
    Boolean(commentId) && (busyAction === "draft" || Boolean(draftText.trim()));
  return (
    <div className="yt-comment-inbox-card">
      <div className="yt-comment-author">{comment.author}</div>
      <div className="yt-comment-body">{comment.text}</div>
      <YouTubeCommentLikeCount likeCount={comment.like_count} />
      <YouTubeCommentThreadReplies
        parentId={commentId}
        replies={comment.replies}
        totalReplyCount={comment.total_reply_count}
      />
      <textarea
        className="yt-comment-draft"
        value={draftText}
        onChange={(event) => onDraftChange(event.target.value)}
        rows={2}
        placeholder="Draft reply…"
        disabled={!commentId}
      />
      {busyAction === "draft" || busyAction === "send" ? (
        <YouTubeCommentActionProgressPanel action={busyAction} />
      ) : null}
      <div className="yt-comment-actions">
        {canCancelDraft ? (
          <button
            type="button"
            className="yt-rail-btn"
            disabled={busy && busyAction !== "draft"}
            onClick={onCancelDraft}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="yt-rail-btn"
          disabled={busy || !commentId}
          onClick={onDraft}
        >
          Draft with AI
        </button>
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          disabled={busy || !draftText.trim() || !commentId}
          onClick={onSend}
        >
          Send (HITL)
        </button>
      </div>
    </div>
  );
};
