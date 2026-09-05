import React, { useEffect, useState } from "react";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import {
  youtubeCommentReplyCountLabel,
  type YouTubeInboxReply,
} from "./youtubeCommentVideoGroups";
import { YouTubeCommentThreadReplyRow } from "./YouTubeCommentThreadReplyRow";

function mergeYouTubeInboxReplies(
  current: YouTubeInboxReply[],
  incoming: YouTubeInboxReply[] | null | undefined,
): YouTubeInboxReply[] {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return current;
  }
  const seen = new Set(
    current.map((row) => (row.comment_id || "").trim()).filter(Boolean),
  );
  const next = [...current];
  for (const row of incoming) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const id = (row.comment_id || "").trim();
    if (id && seen.has(id)) {
      continue;
    }
    if (id) {
      seen.add(id);
    }
    next.push(row);
  }
  return next;
}

export const YouTubeCommentThreadReplies: React.FC<{
  parentId?: string;
  replies?: YouTubeInboxReply[] | null;
  totalReplyCount?: number;
}> = ({ parentId, replies, totalReplyCount }) => {
  const [rows, setRows] = useState<YouTubeInboxReply[]>(
    Array.isArray(replies) ? replies : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);

  useEffect(() => {
    setRows(Array.isArray(replies) ? replies : []);
    setLoadedMore(false);
    setError(null);
  }, [parentId, replies]);

  const count = Math.max(Number(totalReplyCount) || 0, rows.length);
  const canShowMore = Boolean(parentId) && !loadedMore && count > rows.length;

  if (count <= 0) {
    return null;
  }

  const loadMore = async () => {
    if (!parentId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      console.info("[YouTubeCommentThreadReplies] Show more start", {
        hasParentId: true,
      });
      const res = await youtubeStudioApi.listCommentReplies({
        parent_id: parentId,
        max_results: 20,
      });
      if (!res?.success) {
        console.warn("[YouTubeCommentThreadReplies] Show more unsuccessful", {
          hasMessage: Boolean(res?.message),
        });
        setError(res?.message || "Could not load replies. Please try again.");
        return;
      }
      const extra = Array.isArray(res.replies) ? res.replies : [];
      console.info("[YouTubeCommentThreadReplies] Show more complete", {
        replyCount: extra.length,
        hasParentId: true,
      });
      setRows((prev) => mergeYouTubeInboxReplies(prev, extra));
      setLoadedMore(true);
    } catch (loadError) {
      console.error("[YouTubeCommentThreadReplies] Show more failed", {
        errorName: loadError instanceof Error ? loadError.name : "Error",
      });
      setError("Could not load replies. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="yt-comment-thread-replies">
      <div className="yt-comment-thread-replies-heading">
        <span className="yt-comment-thread-replies-label">Replies</span>
        <span className="yt-comment-thread-replies-count">
          {youtubeCommentReplyCountLabel(count)}
        </span>
      </div>
      {rows.map((reply, index) => (
        <YouTubeCommentThreadReplyRow
          key={reply.comment_id || `reply-${index}`}
          reply={reply}
          onSaved={(commentId, text) =>
            setRows((prev) =>
              prev.map((row) =>
                row.comment_id === commentId ? { ...row, text } : row,
              ),
            )
          }
        />
      ))}
      {error ? (
        <p className="yt-comment-thread-replies-error">{error}</p>
      ) : null}
      {canShowMore ? (
        <button
          type="button"
          className="yt-rail-btn"
          disabled={busy}
          onClick={() => void loadMore()}
        >
          Show more replies
        </button>
      ) : null}
    </div>
  );
};
