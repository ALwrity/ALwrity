import React from "react";
import { youtubeCommentCountLabel } from "./youtubeCommentVideoGroups";

export const YouTubeCommentVideoGroup: React.FC<{
  heading: string;
  commentCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ heading, commentCount, expanded, onToggle, children }) => {
  const countLabel = youtubeCommentCountLabel(commentCount);
  return (
    <section className="yt-comment-video-group">
      <button
        type="button"
        className="yt-comment-video-group-header"
        aria-expanded={expanded}
        aria-label={`Your video ${heading}, ${countLabel}`}
        onClick={onToggle}
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
      {expanded ? <div className="yt-comment-video-group-body">{children}</div> : null}
    </section>
  );
};
