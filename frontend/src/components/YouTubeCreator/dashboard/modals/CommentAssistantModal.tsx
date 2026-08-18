import React, { useCallback, useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import type { PhaseModalSharedProps } from "./phaseModalTypes";

export const CommentAssistantModal: React.FC<
  PhaseModalSharedProps & { open: boolean; onClose: () => void }
> = ({ open, onClose, niche }) => {
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
      const res = await youtubeStudioApi.getCommentInbox({ max_results: 20 });
      if (!res.success) {
        setError(res.message || "Failed to load comments");
        setComments([]);
      } else {
        setComments(res.comments || []);
      }
    } catch (e: any) {
      setError(e?.message || "Inbox failed");
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
      const res = await youtubeStudioApi.draftCommentReply({
        comment_text: c.text || "",
        channel_niche: niche || undefined,
      });
      if (res.success && res.draft) {
        setDrafts((prev) => ({ ...prev, [c.comment_id]: res.draft }));
      } else {
        setStatus(res.message || "Draft failed");
      }
    } catch (e: any) {
      setStatus(e?.message || "Draft failed");
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
      const res = await youtubeStudioApi.sendCommentReply({
        parent_id: c.comment_id,
        text,
      });
      setStatus(res.message || (res.success ? "Reply sent" : "Send failed"));
      if (res.success) void load();
    } catch (e: any) {
      setStatus(e?.message || "Send failed");
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
      maxWidth={640}
    >
      {loading && <p className="yt-modal-intro">Loading inbox…</p>}
      {error && <p className="yt-modal-intro">{error}</p>}
      {status && <p className="yt-modal-intro">{status}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {comments.map((c) => (
          <div
            key={c.comment_id}
            style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</div>
            <div style={{ fontSize: 13, color: "#606060", margin: "6px 0" }}>{c.text}</div>
            <textarea
              value={drafts[c.comment_id] || ""}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [c.comment_id]: e.target.value }))
              }
              rows={2}
              placeholder="Draft reply…"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                padding: 8,
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
