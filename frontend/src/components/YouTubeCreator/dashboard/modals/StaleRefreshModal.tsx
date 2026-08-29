import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import type { PhaseModalSharedProps } from "./phaseModalTypes";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const StaleRefreshModal: React.FC<
  PhaseModalSharedProps & {
    open: boolean;
    onClose: () => void;
    shell?: YouTubeModalShellProps;
  }
> = ({ open, onClose, niche, shell }) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSuggestion(null);
    setSelected(null);
    setLoading(true);
    setStatus(null);
    youtubeStudioApi
      .listChannelVideos({ max_results: 12 })
      .then((res) => {
        setVideos(res.videos || []);
        if (!res.success) setStatus(res.message);
      })
      .catch((e) => setStatus(e?.message || "Failed to load videos"))
      .finally(() => setLoading(false));
  }, [open]);

  const suggest = async (video: any) => {
    setSelected(video);
    setLoading(true);
    setStatus(null);
    try {
      const res = await youtubeStudioApi.suggestStaleRefresh({
        title: video.title || "",
        description: video.description || "",
        tags: video.tags || [],
        niche: niche || undefined,
      });
      if (res.success) setSuggestion(res.suggestion);
      else setStatus(res.message);
    } catch (e: any) {
      setStatus(e?.message || "Suggest failed");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!selected?.video_id || !suggestion) return;
    setLoading(true);
    try {
      const res = await youtubeStudioApi.updateVideoMetadata({
        video_id: selected.video_id,
        title: suggestion.new_title,
        description: suggestion.new_description,
        tags: suggestion.new_tags,
      });
      setStatus(res.message || (res.success ? "Updated on YouTube" : "Update failed"));
    } catch (e: any) {
      setStatus(e?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Stale Video Refresh"
      intro="Pick a published video — AI proposes title/desc/tags; you approve before update."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {loading && <p className="yt-modal-intro">Working…</p>}
      {status && <p className="yt-modal-intro">{status}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }}>
        {videos.map((v) => (
          <button
            key={v.video_id}
            type="button"
            className="yt-rail-btn"
            style={{ justifyContent: "flex-start" }}
            onClick={() => void suggest(v)}
          >
            {v.title} · {v.view_count != null ? v.view_count : "?"} views
          </button>
        ))}
      </div>
      {suggestion && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontWeight: 800 }}>Suggested title</p>
          <p>{suggestion.new_title}</p>
          <p style={{ fontWeight: 800 }}>Description</p>
          <p style={{ fontSize: 13, color: "#606060", whiteSpace: "pre-wrap" }}>
            {suggestion.new_description}
          </p>
          <p style={{ fontWeight: 800 }}>Tags</p>
          <p style={{ fontSize: 13 }}>{(suggestion.new_tags || []).join(", ")}</p>
          <p style={{ fontSize: 12, color: "#64748b" }}>{suggestion.rationale}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="yt-rail-btn yt-rail-btn--primary" onClick={() => void apply()}>
              Apply to YouTube (HITL)
            </button>
            {suggestion.pin_comment && (
              <button
                type="button"
                className="yt-rail-btn"
                onClick={() => void navigator.clipboard?.writeText(suggestion.pin_comment)}
              >
                Copy pin comment
              </button>
            )}
          </div>
        </div>
      )}
    </YouTubeActionModal>
  );
};
