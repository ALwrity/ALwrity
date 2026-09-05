import React, { useEffect, useRef } from "react";
import { youtubeCommentCountLabel } from "./youtubeCommentVideoGroups";
import { isYouTubeIframeVideoId } from "./youtubeCommentEmbedVideoId";
import { YouTubeCommentIframePlayer } from "./YouTubeCommentIframePlayer";
import { youtubeCommentChainWorkPaneWheel } from "./youtubeCommentWorkPaneScrollChain";

export const YouTubeCommentVideoGroup: React.FC<{
  heading: string;
  commentCount: number;
  expanded: boolean;
  onToggle: () => void;
  videoId?: string | null;
  children: React.ReactNode;
}> = ({ heading, commentCount, expanded, onToggle, videoId, children }) => {
  const countLabel = youtubeCommentCountLabel(commentCount);
  const embedId = (videoId || "").trim();
  const showPlayer = isYouTubeIframeVideoId(embedId);
  const workPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    console.info("[YouTubeCommentVideoGroup] Layout expanded", {
      showPlayer,
      hasVideoId: Boolean(embedId),
    });
  }, [expanded, showPlayer, embedId]);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }
    const pane = workPaneRef.current;
    if (!pane) {
      console.warn("[YouTubeCommentVideoGroup] Work pane missing for scroll chain");
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) {
        return;
      }
      if (!youtubeCommentChainWorkPaneWheel(pane, event.deltaY)) {
        return;
      }
      event.preventDefault();
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      pane.removeEventListener("wheel", onWheel);
    };
  }, [expanded, showPlayer]);

  return (
    <section className="yt-comment-video-group">
      <button
        type="button"
        className="yt-comment-video-group-header"
        aria-expanded={expanded}
        onClick={onToggle}
        aria-label={`Your video ${heading}, ${countLabel}`}
      >
        <div className="yt-comment-video-group-header-row">
          <span className="yt-comment-video-group-kicker">Your video</span>
          <span className="yt-comment-video-group-meta">
            <span className="yt-comment-video-group-count">{countLabel}</span>
            <span className="yt-comment-video-group-chevron" aria-hidden="true">
              {expanded ? "▾" : "▸"}
            </span>
          </span>
        </div>
        <div className="yt-comment-video-heading">{heading}</div>
      </button>
      {expanded ? (
        <div
          className={
            showPlayer
              ? "yt-comment-video-group-body yt-comment-video-group-body--split"
              : "yt-comment-video-group-body"
          }
        >
          {showPlayer ? (
            <div className="yt-comment-video-group-context">
              <YouTubeCommentIframePlayer videoId={embedId} />
            </div>
          ) : null}
          <div className="yt-comment-video-group-work" ref={workPaneRef}>
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
};
