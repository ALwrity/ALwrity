import React, { useEffect, useMemo, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";
import {
  pickMostViewedVideo,
  sortChannelVideos,
  type YouTubeVideoPerformanceRow,
  type YouTubeVideoPerformanceSort,
} from "../youtubeVideoPerformanceStats";
import { YouTubeVideoPerformanceCard } from "./YouTubeVideoPerformanceCard";
import "../youtubeVideoPerformanceLayout.css";

const LOAD_FAILED = "Could not load videos. Please try again.";

export const YouTubeVideoPerformanceModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [videos, setVideos] = useState<YouTubeVideoPerformanceRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [sort, setSort] = useState<YouTubeVideoPerformanceSort>("views");

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus(null);
    setVideos([]);
    setSort("views");
    let cancelled = false;
    console.info("[YouTubeVideoPerformance] List start");
    youtubeStudioApi
      .listChannelVideos({ max_results: 50 })
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

  const sortedVideos = useMemo(
    () => sortChannelVideos(videos, sort),
    [videos, sort],
  );
  const highlight = useMemo(() => pickMostViewedVideo(videos), [videos]);

  const onSort = (next: YouTubeVideoPerformanceSort) => {
    if (next === sort) {
      return;
    }
    console.info("[YouTubeVideoPerformance] Sort changed", { sort: next });
    setSort(next);
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Video Performance"
      intro="Recent uploads with public views, likes, and comments. This is not watch time or click-through rate."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {status ? <p className="yt-modal-intro">{status}</p> : null}
      {videos.length > 0 ? (
        <>
          <div className="yt-video-performance-sort">
            <button
              type="button"
              className={
                sort === "views" ? "yt-rail-btn yt-rail-btn--primary" : "yt-rail-btn"
              }
              aria-pressed={sort === "views"}
              onClick={() => onSort("views")}
            >
              Most views
            </button>
            <button
              type="button"
              className={
                sort === "newest" ? "yt-rail-btn yt-rail-btn--primary" : "yt-rail-btn"
              }
              aria-pressed={sort === "newest"}
              onClick={() => onSort("newest")}
            >
              Newest
            </button>
          </div>
          {highlight ? (
            <div className="yt-rail-panel yt-video-performance-highlight">
              <p className="yt-video-performance-highlight__label">
                Most views in this list
              </p>
              <p className="yt-video-performance-highlight__title">
                {highlight.title || "Untitled"}
              </p>
            </div>
          ) : null}
          <div className="yt-video-performance-list yt-video-performance-list--split">
            {sortedVideos.map((video, index) => (
              <YouTubeVideoPerformanceCard
                key={video.video_id || `yt-perf-${index}`}
                video={video}
              />
            ))}
          </div>
        </>
      ) : null}
    </YouTubeActionModal>
  );
};
