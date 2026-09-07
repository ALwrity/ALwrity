import React from "react";
import {
  formatPublishedDate,
  formatPublicCount,
  likesPerThousandViews,
  YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL,
  type YouTubeVideoPerformanceRow,
} from "../youtubeVideoPerformanceStats";

export const YouTubeVideoPerformanceCard: React.FC<{
  video: YouTubeVideoPerformanceRow;
}> = ({ video }) => {
  const title = video.title || "Untitled";
  const watchUrl = video.video_id
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.video_id)}`
    : null;

  return (
    <article
      className="yt-video-performance-card yt-video-performance-card--split"
      aria-label={title}
    >
      <div className="yt-video-performance-card__context">
        <div className="yt-video-performance-card__media">
          {video.thumbnail ? <img src={video.thumbnail} alt="" /> : null}
        </div>
      </div>
      <div className="yt-video-performance-card__work">
        <div className="yt-video-performance-card__heading">
          <h3 className="yt-video-performance-card__title">{title}</h3>
          {watchUrl ? (
            <a
              className="yt-video-performance-card__open"
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL}
              data-tooltip={YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL}
            >
              <svg
                className="yt-video-performance-card__open-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"
                />
              </svg>
            </a>
          ) : null}
        </div>
        <div className="yt-rail-stat-row">
          <span className="yt-rail-stat-label">Views</span>
          <span className="yt-rail-stat-value">{formatPublicCount(video.view_count)}</span>
        </div>
        <div className="yt-rail-stat-row">
          <span className="yt-rail-stat-label">Likes</span>
          <span className="yt-rail-stat-value">{formatPublicCount(video.like_count)}</span>
        </div>
        <div className="yt-rail-stat-row">
          <span className="yt-rail-stat-label">Comments</span>
          <span className="yt-rail-stat-value">
            {formatPublicCount(video.comment_count)}
          </span>
        </div>
        <div className="yt-rail-stat-row">
          <span className="yt-rail-stat-label">Published</span>
          <span className="yt-rail-stat-value">
            {formatPublishedDate(video.published_at)}
          </span>
        </div>
        <div className="yt-rail-stat-row">
          <span className="yt-rail-stat-label">Likes per 1,000 views</span>
          <span className="yt-rail-stat-value">
            {likesPerThousandViews(video.like_count, video.view_count)}
          </span>
        </div>
      </div>
    </article>
  );
};
