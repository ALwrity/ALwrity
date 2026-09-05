import React from "react";
import type { YouTubeInboxComment } from "./youtubeCommentVideoGroups";
import { YouTubeCommentThreadReplies } from "./YouTubeCommentThreadReplies";

export const YouTubeCommentInboxRow: React.FC<{
  comment: YouTubeInboxComment;
  draftText: string;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onDraft: () => void;
  onSend: () => void;
}> = ({ comment, draftText, busy, onDraftChange, onDraft, onSend }) => {
  const commentId = comment.comment_id || "";
  return (
    <div className="yt-comment-inbox-card">
      <div className="yt-comment-author">{comment.author}</div>
      <div className="yt-comment-body">{comment.text}</div>
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
      <div className="yt-comment-actions">
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
