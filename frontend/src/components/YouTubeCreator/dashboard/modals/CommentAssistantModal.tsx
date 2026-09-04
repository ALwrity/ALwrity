import React, { useCallback, useEffect, useMemo, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { YouTubeCommentInboxRow } from "../YouTubeCommentInboxRow";
import { YouTubeCommentVideoGroup } from "../YouTubeCommentVideoGroup";
import {
  groupYouTubeInboxCommentsByVideo,
  type YouTubeInboxComment,
} from "../youtubeCommentVideoGroups";
import { isYouTubeIframeVideoId } from "../youtubeCommentEmbedVideoId";
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
  const [comments, setComments] = useState<YouTubeInboxComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const videoGroups = useMemo(
    () => groupYouTubeInboxCommentsByVideo(comments),
    [comments],
  );

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
      } else if (!Array.isArray(res.comments)) {
        console.warn("[YouTubeCommentAssistant] Inbox unsuccessful", {
          commentsIsArray: false,
        });
        setError("Could not load comments. Please try again.");
        setComments([]);
      } else {
        const next = res.comments;
        const groups = groupYouTubeInboxCommentsByVideo(next);
        console.info("[YouTubeCommentAssistant] Inbox load complete", {
          commentCount: next.length,
          groupCount: groups.length,
          hasEmbeddableVideo: groups.some((group) =>
            isYouTubeIframeVideoId(group.key),
          ),
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

  const firstGroupKey = videoGroups[0]?.key ?? null;

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    setExpandedGroupKey(firstGroupKey);
  }, [comments, firstGroupKey]);

  const draft = async (c: YouTubeInboxComment) => {
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

  const send = async (c: YouTubeInboxComment) => {
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
        {videoGroups.map((group) => (
          <YouTubeCommentVideoGroup
            key={group.key}
            heading={group.heading}
            commentCount={group.comments.length}
            videoId={group.key}
            expanded={expandedGroupKey === group.key}
            onToggle={() =>
              setExpandedGroupKey((prev) => (prev === group.key ? null : group.key))
            }
          >
            {group.comments.map((c, rowIndex) => (
              <YouTubeCommentInboxRow
                key={c.comment_id || `${group.key}-${rowIndex}`}
                comment={c}
                draftText={drafts[c.comment_id || ""] || ""}
                busy={busyId === c.comment_id}
                onDraftChange={(value) =>
                  setDrafts((prev) => ({ ...prev, [c.comment_id || ""]: value }))
                }
                onDraft={() => void draft(c)}
                onSend={() => void send(c)}
              />
            ))}
          </YouTubeCommentVideoGroup>
        ))}
        {!loading && comments.length === 0 && !error && (
          <p className="yt-modal-intro">No recent comments found.</p>
        )}
      </div>
    </YouTubeActionModal>
  );
};
