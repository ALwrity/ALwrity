import React, { useState } from "react";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import { YouTubeCommentActionProgressPanel } from "./YouTubeCommentActionProgressPanel";
import { YouTubeCommentParentOverflowMenu } from "./YouTubeCommentParentOverflowMenu";
import type { YouTubeCommentProgressAction } from "./youtubeCommentActionLoader";

const HIDE_COMMENT_CONFIRM =
  "Hide this comment? It and its replies will no longer show on the video.";
const HIDE_USER_CONFIRM =
  "Hide this user from the channel? This comment is removed and future comments from this author are auto-rejected. You cannot undo the hidden-user list from ALwrity; manage it in YouTube Studio Community settings.";

type ModerateKind = "hide" | "hideUser";

export const YouTubeCommentParentModerate: React.FC<{
  commentId: string;
  canHideUser: boolean;
  disabled?: boolean;
  onHidden: (message: string) => void;
  children: (menu: React.ReactNode, confirm: React.ReactNode) => React.ReactNode;
}> = ({ commentId, canHideUser, disabled, onHidden, children }) => {
  const [kind, setKind] = useState<ModerateKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressAction: YouTubeCommentProgressAction | null = busy
    ? kind === "hideUser"
      ? "hideUser"
      : "hide"
    : null;

  const confirm = async () => {
    if (busy || !commentId || !kind) {
      return;
    }
    const banAuthor = kind === "hideUser";
    setBusy(true);
    setError(null);
    try {
      console.info("[YouTubeCommentParentModerate] Moderate start", {
        hasCommentId: true,
        banAuthor,
      });
      const res = await youtubeStudioApi.setCommentModerationStatus({
        comment_id: commentId,
        ban_author: banAuthor,
      });
      if (!res?.success) {
        console.warn("[YouTubeCommentParentModerate] Moderate unsuccessful", {
          hasMessage: Boolean(res?.message),
        });
        setError(res?.message || "Could not hide that comment. Please try again.");
        return;
      }
      console.info("[YouTubeCommentParentModerate] Moderate complete", {
        hasCommentId: true,
        banAuthor,
      });
      onHidden(
        res.message ||
          (banAuthor ? "User hidden from the channel." : "Comment hidden."),
      );
    } catch (moderateError) {
      console.error("[YouTubeCommentParentModerate] Moderate failed", {
        errorName: moderateError instanceof Error ? moderateError.name : "Error",
      });
      setError("Could not hide that comment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const menu =
    commentId && !kind ? (
      <YouTubeCommentParentOverflowMenu
        canHideUser={canHideUser}
        disabled={disabled}
        onHideComment={() => {
          setError(null);
          setKind("hide");
        }}
        onHideUser={() => {
          setError(null);
          setKind("hideUser");
        }}
      />
    ) : null;

  const confirmPanel = kind ? (
    <>
      <p className="yt-comment-thread-reply-confirm">
        {kind === "hideUser" ? HIDE_USER_CONFIRM : HIDE_COMMENT_CONFIRM}
      </p>
      {error ? <p className="yt-comment-thread-replies-error">{error}</p> : null}
      {progressAction ? (
        <YouTubeCommentActionProgressPanel action={progressAction} />
      ) : null}
      <div className="yt-comment-actions">
        <button
          type="button"
          className="yt-rail-btn"
          disabled={busy}
          onClick={() => {
            setError(null);
            setKind(null);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="yt-rail-btn yt-rail-btn--primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {kind === "hideUser" ? "Hide user from channel" : "Hide comment"}
        </button>
      </div>
    </>
  ) : null;

  return <>{children(menu, confirmPanel)}</>;
};
