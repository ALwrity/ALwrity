import React, { useCallback, useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { youtubeCommentVideoHeading } from "../youtubeCommentVideoHeading";
import type { PhaseModalSharedProps } from "./phaseModalTypes";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const CommentAssistantModal: React.FC<
  PhaseModalSharedProps & {
    open: boolean;
    onClose: () => void;
    shell?: YouTubeModalShellProps;
  }
> = ({ open, onClose, niche, shell }) => {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.info("[YouTubeCommentAssistant] Inbox load start");
      const res = await youtubeStudioApi.getCommentInbox({ max_results: 20 });
      if (!res.success) {
        console.warn("[YouTubeCommentAssistant] Inbox unsuccessful", {
          hasMessage: Boolean(res.message),
        });
        setError(res.message || "Could not load comments. Please try again.");
        setComments([]);
      } else {
        const next = res.comments || [];
        console.info("[YouTubeCommentAssistant] Inbox load complete", {
          commentCount: next.length,
        });
        setComments(next);
      }
    } catch (loadError) {
      console.error("[YouTubeCommentAssistant] Inbox load failed", {
        errorName: loadError instanceof Error ? loadError.name : "Error",
      });
      setError("Could not load comments. Please try again.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const draft = async (c: any) => {
    setBusyId(c.comment_id);
    setStatus(null);
    try {
      console.info("[YouTubeCommentAssistant] Draft start", {
        hasCommentId: Boolean(c.comment_id),
        commentLength: (c.text || "").length,
      });
      const res = await youtubeStudioApi.draftCommentReply({
        comment_text: c.text || "",
        channel_niche: niche || undefined,
        video_title: c.video_title || undefined,
      });
      if (res.success && res.draft) {
        console.info("[YouTubeCommentAssistant] Draft complete", {
          hasCommentId: Boolean(c.comment_id),
        });
        setDrafts((prev) => ({ ...prev, [c.comment_id]: res.draft }));
      } else {
        console.warn("[YouTubeCommentAssistant] Draft unsuccessful", {
          hasMessage: Boolean(res.message),
        });
        setStatus(res.message || "Could not draft a reply. Please try again.");
      }
    } catch (draftError) {
      console.error("[YouTubeCommentAssistant] Draft failed", {
        errorName: draftError instanceof Error ? draftError.name : "Error",
      });
      setStatus("Could not draft a reply. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const send = async (c: any) => {
    const text = drafts[c.comment_id]?.trim();
    if (!text) return;
    setBusyId(c.comment_id);
    setStatus(null);
    try {
      console.info("[YouTubeCommentAssistant] Send start", {
        hasCommentId: Boolean(c.comment_id),
        replyLength: text.length,
      });
      const res = await youtubeStudioApi.sendCommentReply({
        parent_id: c.comment_id,
        text,
      });
      setStatus(res.message || (res.success ? "Reply sent" : "Could not send that reply. Please try again."));
      if (res.success) {
        console.info("[YouTubeCommentAssistant] Send complete", {
          hasCommentId: Boolean(c.comment_id),
        });
        void load();
      } else {
        console.warn("[YouTubeCommentAssistant] Send unsuccessful", {
          hasMessage: Boolean(res.message),
        });
      }
    } catch (sendError) {
      console.error("[YouTubeCommentAssistant] Send failed", {
        errorName: sendError instanceof Error ? sendError.name : "Error",
      });
      setStatus("Could not send that reply. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Comment Reply Assistant"
      intro="ALwrity drafts replies in your voice — you edit and send (HITL)."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {loading && <p className="yt-modal-intro">Loading inbox…</p>}
      {error && <p className="yt-modal-intro">{error}</p>}
      {status && <p className="yt-modal-intro">{status}</p>}
      <div className="yt-comment-list">
        {comments.map((c) => (
          <div key={c.comment_id} className="yt-comment-inbox-card">
            <div className="yt-comment-video-heading">
              {youtubeCommentVideoHeading(c)}
            </div>
            <div className="yt-comment-author">{c.author}</div>
            <div className="yt-comment-body">{c.text}</div>
            <textarea
              className="yt-comment-draft"
              value={drafts[c.comment_id] || ""}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [c.comment_id]: e.target.value }))
              }
              rows={2}
              placeholder="Draft reply…"
            />
            <div className="yt-comment-actions">
              <button
                type="button"
                className="yt-rail-btn"
                disabled={busyId === c.comment_id}
                onClick={() => void draft(c)}
              >
                Draft with AI
              </button>
              <button
                type="button"
                className="yt-rail-btn yt-rail-btn--primary"
                disabled={busyId === c.comment_id || !drafts[c.comment_id]?.trim()}
                onClick={() => void send(c)}
              >
                Send (HITL)
              </button>
            </div>
          </div>
        ))}
        {!loading && comments.length === 0 && !error && (
          <p className="yt-modal-intro">No recent comments found.</p>
        )}
      </div>
    </YouTubeActionModal>
  );
};
