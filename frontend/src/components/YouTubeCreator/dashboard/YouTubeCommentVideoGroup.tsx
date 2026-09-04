import React from "react";
import { youtubeCommentCountLabel } from "./youtubeCommentVideoGroups";
import { isYouTubeIframeVideoId } from "./youtubeCommentEmbedVideoId";
import { YouTubeCommentIframePlayer } from "./YouTubeCommentIframePlayer";

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
        <div className="yt-comment-video-group-body">
          {isYouTubeIframeVideoId(embedId) ? (
            <YouTubeCommentIframePlayer videoId={embedId} />
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
};
