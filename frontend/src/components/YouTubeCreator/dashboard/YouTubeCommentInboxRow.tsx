import React from "react";
import type { YouTubeInboxComment } from "./youtubeCommentVideoGroups";
import { YouTubeCommentThreadReplies } from "./YouTubeCommentThreadReplies";
import { YouTubeCommentActionProgressPanel } from "./YouTubeCommentActionProgressPanel";
import { YouTubeCommentLikeCount } from "./YouTubeCommentLikeCount";
import { YouTubeCommentParentModerate } from "./YouTubeCommentParentModerate";
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
  onHidden: (commentId: string, message: string) => void;
}> = ({
  comment,
  draftText,
  busy,
  busyAction,
  onDraftChange,
  onDraft,
  onSend,
  onCancelDraft,
  onHidden,
}) => {
  const commentId = comment.comment_id || "";
  const canCancelDraft =
    Boolean(commentId) && (busyAction === "draft" || Boolean(draftText.trim()));
  const canHideUser = comment.can_hide_user !== false;
  return (
    <YouTubeCommentParentModerate
      commentId={commentId}
      canHideUser={canHideUser}
      disabled={busy}
      onHidden={(message) => onHidden(commentId, message)}
    >
      {(menu, confirm) => (
        <div className="yt-comment-inbox-card">
          <div className="yt-comment-inbox-head">
            <div className="yt-comment-author">{comment.author}</div>
            {menu}
          </div>
          <div className="yt-comment-body">{comment.text}</div>
          <YouTubeCommentLikeCount likeCount={comment.like_count} />
          {confirm}
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
      )}
    </YouTubeCommentParentModerate>
  );
};
