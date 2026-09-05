import React, { useState } from "react";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import type { YouTubeInboxReply } from "./youtubeCommentVideoGroups";
import { YouTubeCommentReplyOverflowMenu } from "./YouTubeCommentReplyOverflowMenu";

export const YouTubeCommentThreadReplyRow: React.FC<{
  reply: YouTubeInboxReply;
  onSaved: (commentId: string, text: string) => void;
  onDeleted: (commentId: string) => void;
}> = ({ reply, onSaved, onDeleted }) => {
  const commentId = (reply.comment_id || "").trim();
  const original = reply.text || "";
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = Boolean(reply.can_edit && commentId);
  const trimmed = draft.trim();
  const saveDisabled = busy || !trimmed || trimmed === original.trim();

  const cancel = () => {
    setDraft(original);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (saveDisabled || !commentId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      console.info("[YouTubeCommentThreadReplyRow] Update start", {
        hasCommentId: true,
        textLength: trimmed.length,
      });
      const res = await youtubeStudioApi.updateCommentReply({
        comment_id: commentId,
        text: trimmed,
      });
      if (!res?.success) {
        console.warn("[YouTubeCommentThreadReplyRow] Update unsuccessful", {
          hasMessage: Boolean(res?.message),
        });
        setError(res?.message || "Could not save that edit. Please try again.");
        return;
      }
      const nextText = (res.text || trimmed).trim() || trimmed;
      console.info("[YouTubeCommentThreadReplyRow] Update complete", {
        hasCommentId: true,
      });
      onSaved(commentId, nextText);
      setEditing(false);
    } catch (saveError) {
      console.error("[YouTubeCommentThreadReplyRow] Update failed", {
        errorName: saveError instanceof Error ? saveError.name : "Error",
      });
      setError("Could not save that edit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (busy || !commentId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      console.info("[YouTubeCommentThreadReplyRow] Delete start", {
        hasCommentId: true,
      });
      const res = await youtubeStudioApi.deleteCommentReply({
        comment_id: commentId,
      });
      if (!res?.success) {
        console.warn("[YouTubeCommentThreadReplyRow] Delete unsuccessful", {
          hasMessage: Boolean(res?.message),
        });
        setError(res?.message || "Could not delete that reply. Please try again.");
        return;
      }
      console.info("[YouTubeCommentThreadReplyRow] Delete complete", {
        hasCommentId: true,
      });
      onDeleted(commentId);
    } catch (deleteError) {
      console.error("[YouTubeCommentThreadReplyRow] Delete failed", {
        errorName: deleteError instanceof Error ? deleteError.name : "Error",
      });
      setError("Could not delete that reply. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="yt-comment-thread-reply">
      <div className="yt-comment-thread-reply-head">
        {reply.author ? (
          <div className="yt-comment-thread-reply-author">{reply.author}</div>
        ) : null}
        {canEdit && !editing && !confirmingDelete ? (
          <YouTubeCommentReplyOverflowMenu
            onEdit={() => {
              setDraft(original);
              setError(null);
              setEditing(true);
            }}
            onDelete={() => {
              setError(null);
              setConfirmingDelete(true);
            }}
          />
        ) : null}
      </div>
      {editing ? (
        <>
          <textarea
            className="yt-comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            aria-label="Edit reply"
            disabled={busy}
          />
          {error ? (
            <p className="yt-comment-thread-replies-error">{error}</p>
          ) : null}
          <div className="yt-comment-actions">
            <button
              type="button"
              className="yt-rail-btn"
              disabled={busy}
              onClick={cancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="yt-rail-btn yt-rail-btn--primary"
              disabled={saveDisabled}
              onClick={() => void save()}
            >
              Save
            </button>
          </div>
        </>
      ) : confirmingDelete ? (
        <>
          {reply.text ? (
            <div className="yt-comment-thread-reply-body">{reply.text}</div>
          ) : null}
          <p className="yt-comment-thread-reply-confirm">Delete this reply?</p>
          {error ? (
            <p className="yt-comment-thread-replies-error">{error}</p>
          ) : null}
          <div className="yt-comment-actions">
            <button
              type="button"
              className="yt-rail-btn"
              disabled={busy}
              onClick={() => {
                setError(null);
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="yt-rail-btn yt-rail-btn--primary"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Delete
            </button>
          </div>
        </>
      ) : reply.text ? (
        <div className="yt-comment-thread-reply-body">{reply.text}</div>
      ) : null}
    </div>
  );
};
