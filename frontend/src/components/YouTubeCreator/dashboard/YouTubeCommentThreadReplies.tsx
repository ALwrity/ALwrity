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
  const [removedCount, setRemovedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const repliesSyncKey = `${parentId || ""}:${(Array.isArray(replies) ? replies : [])
    .map((row) => (row.comment_id || "").trim())
    .join("|")}`;

  useEffect(() => {
    setRows(Array.isArray(replies) ? replies : []);
    setRemovedCount(0);
    setLoadedMore(false);
    setError(null);
    setExpanded(false);
  }, [repliesSyncKey]);

  const count = Math.max((Number(totalReplyCount) || 0) - removedCount, rows.length);
  const canShowMore =
    expanded && Boolean(parentId) && !loadedMore && count > rows.length;

  if (rows.length === 0 && removedCount === 0) {
    return null;
  }

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
      if (extra.length === 0) {
        setRemovedCount(Math.max(Number(totalReplyCount) || 0, 0));
        setLoadedMore(true);
        return;
      }
      setRows((prev) => mergeYouTubeInboxReplies(prev, extra));
      setLoadedMore(true);
      setExpanded(true);
    } catch (loadError) {
      console.error("[YouTubeCommentThreadReplies] Show more failed", {
        errorName: loadError instanceof Error ? loadError.name : "Error",
      });
      setError("Could not load replies. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openThread = () => {
    console.info("[YouTubeCommentThreadReplies] Thread expand", {
      hasParentId: Boolean(parentId),
      inlinedCount: rows.length,
    });
    if (rows.length > 0) {
      setExpanded(true);
      return;
    }
    void loadMore();
  };

  if (!expanded || rows.length === 0) {
    return (
      <div className="yt-comment-thread-replies">
        {error ? (
          <p className="yt-comment-thread-replies-error">{error}</p>
        ) : null}
        <button
          type="button"
          className="yt-comment-thread-replies-expand"
          aria-label={youtubeCommentReplyCountLabel(count)}
          aria-expanded={false}
          disabled={busy || !parentId}
          onClick={openThread}
        >
          <span>{youtubeCommentReplyCountLabel(count)}</span>
          <span className="yt-comment-thread-replies-expand-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="yt-comment-thread-replies">
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
          onDeleted={(commentId) => {
            setRows((prev) => prev.filter((row) => row.comment_id !== commentId));
            setRemovedCount((prev) => prev + 1);
          }}
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
      <button
        type="button"
        className="yt-comment-thread-replies-expand"
        aria-label="Hide replies"
        aria-expanded={true}
        onClick={() => {
          console.info("[YouTubeCommentThreadReplies] Thread collapse", {
            hasParentId: Boolean(parentId),
            replyCount: rows.length,
          });
          setExpanded(false);
        }}
      >
        <span>Hide replies</span>
        <span className="yt-comment-thread-replies-expand-chevron" aria-hidden="true">
          ▴
        </span>
      </button>
    </div>
  );
};
