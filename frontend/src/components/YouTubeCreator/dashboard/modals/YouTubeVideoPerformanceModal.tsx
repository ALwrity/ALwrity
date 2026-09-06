import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

const LOAD_FAILED = "Could not load videos. Please try again.";

type ChannelVideoRow = {
  video_id?: string;
  title?: string;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  published_at?: string | null;
};

function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return String(value);
}

function formatPublished(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value.slice(0, 10);
}

export const YouTubeVideoPerformanceModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [videos, setVideos] = useState<ChannelVideoRow[]>([]);
  const [selected, setSelected] = useState<ChannelVideoRow | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(null);
    setStatus(null);
    setVideos([]);
    let cancelled = false;
    console.info("[YouTubeVideoPerformance] List start");
    youtubeStudioApi
      .listChannelVideos({ max_results: 12 })
      .then((res) => {
        if (cancelled) {
          return;
        }
        const rows = Array.isArray(res.videos) ? res.videos : [];
        if (!res.success || !Array.isArray(res.videos)) {
          console.warn("[YouTubeVideoPerformance] List unsuccessful", {
            error_code: res.success === false ? res.error_code : "invalid_payload",
          });
          setVideos([]);
          setStatus(res.message || LOAD_FAILED);
          return;
        }
        console.info("[YouTubeVideoPerformance] List complete", {
          videoCount: rows.length,
        });
        setVideos(rows);
        if (rows.length === 0) {
          setStatus(res.message || LOAD_FAILED);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error("[YouTubeVideoPerformance] List failed", {
          errorName: loadError instanceof Error ? loadError.name : "Error",
        });
        setVideos([]);
        setStatus(LOAD_FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onSelect = (video: ChannelVideoRow) => {
    console.info("[YouTubeVideoPerformance] Video selected", {
      hasVideoId: Boolean(video.video_id),
    });
    setSelected(video);
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Video Performance"
      intro="Recent uploads with public view, like, and comment counts from your channel."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {status ? <p className="yt-modal-intro">{status}</p> : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 220,
          overflow: "auto",
        }}
      >
        {videos.map((video, index) => (
          <button
            key={video.video_id || `yt-perf-${index}`}
            type="button"
            className="yt-rail-btn"
            style={{ justifyContent: "flex-start" }}
            aria-pressed={selected === video}
            onClick={() => onSelect(video)}
          >
            {video.title || "Untitled"}
          </button>
        ))}
      </div>
      {selected ? (
        <div style={{ marginTop: 14 }}>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Views</span>
            <span className="yt-rail-stat-value">{formatCount(selected.view_count)}</span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Likes</span>
            <span className="yt-rail-stat-value">{formatCount(selected.like_count)}</span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Comments</span>
            <span className="yt-rail-stat-value">
              {formatCount(selected.comment_count)}
            </span>
          </div>
          <div className="yt-rail-stat-row">
            <span className="yt-rail-stat-label">Published</span>
            <span className="yt-rail-stat-value">
              {formatPublished(selected.published_at)}
            </span>
          </div>
        </div>
      ) : null}
    </YouTubeActionModal>
  );
};
