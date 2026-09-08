import React, { useState } from "react";
import { viewsPolylinePoints } from "../youtubeVideoAnalyticsChart";
import {
  formatAverageViewDuration,
  formatOverviewHeadline,
  formatSubscriberNet,
  formatViewPercentage,
  formatWatchHours,
  previousPeriodChangeLabel,
} from "../youtubeVideoAnalyticsOverviewStats";
import "../youtubeVideoAnalyticsOverview.css";

export type YouTubeChannelOverviewPayload = {
  success?: boolean;
  error_code?: string | null;
  message?: string;
  window_days?: number;
  current?: {
    views?: number | null;
    watch_hours?: number | null;
    subscribers_net?: number | null;
  } | null;
  previous?: {
    views?: number | null;
    watch_hours?: number | null;
    subscribers_net?: number | null;
  } | null;
  views_by_day?: Array<{ date: string; views: number | null }>;
  top_videos?: Array<{
    video_id?: string;
    title?: string | null;
    published_at?: string | null;
    thumbnail?: string | null;
    views?: number | null;
    average_view_duration_seconds?: number | null;
    average_view_percentage?: number | null;
  }>;
  latest_videos?: Array<{
    video_id?: string;
    title?: string | null;
    published_at?: string | null;
    thumbnail?: string | null;
    view_count?: number | null;
    like_count?: number | null;
  }>;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;

export const YouTubeVideoAnalyticsOverview: React.FC<{
  days: number;
  payload: YouTubeChannelOverviewPayload | null;
  status: string | null;
}> = ({ days, payload, status }) => {
  const [latestIndex, setLatestIndex] = useState(0);
  const current = payload?.current;
  const previous = payload?.previous;
  const daySeries = payload?.views_by_day || [];
  const topVideos = payload?.top_videos || [];
  const latest = payload?.latest_videos || [];
  const polyline = viewsPolylinePoints(daySeries, CHART_WIDTH, CHART_HEIGHT);
  const safeIndex = latest.length === 0 ? 0 : Math.min(latestIndex, latest.length - 1);
  const latestRow = latest[safeIndex];

  if (status) {
    return <p className="yt-video-analytics-overview__status">{status}</p>;
  }
  if (!payload) {
    return (
      <p className="yt-video-analytics-overview__status">Loading channel overview.</p>
    );
  }
  if (!payload.success) {
    return (
      <p className="yt-video-analytics-overview__status">
        {payload?.message || "Channel overview is unavailable for this window."}
      </p>
    );
  }

  return (
    <div className="yt-video-analytics-overview">
      <div className="yt-video-analytics-overview__main">
        <h3 className="yt-video-analytics-overview__headline">
          {formatOverviewHeadline(current?.views, days)}
        </h3>
        <div className="yt-video-analytics-overview__cards">
          <div className="yt-video-analytics-overview__card">
            <span className="yt-rail-stat-label">Views</span>
            <span className="yt-rail-stat-value">
              {typeof current?.views === "number" ? current.views : "—"}
            </span>
            <span className="yt-video-analytics-overview__delta">
              {previousPeriodChangeLabel(current?.views, previous?.views, days)}
            </span>
          </div>
          <div className="yt-video-analytics-overview__card">
            <span className="yt-rail-stat-label">Watch time (hours)</span>
            <span className="yt-rail-stat-value">
              {formatWatchHours(current?.watch_hours)}
            </span>
            <span className="yt-video-analytics-overview__delta">
              {previousPeriodChangeLabel(
                current?.watch_hours,
                previous?.watch_hours,
                days,
              )}
            </span>
          </div>
          <div className="yt-video-analytics-overview__card">
            <span className="yt-rail-stat-label">Subscribers</span>
            <span className="yt-rail-stat-value">
              {formatSubscriberNet(current?.subscribers_net)}
            </span>
            <span className="yt-video-analytics-overview__delta">
              {previousPeriodChangeLabel(
                current?.subscribers_net,
                previous?.subscribers_net,
                days,
              )}
            </span>
          </div>
        </div>
        {polyline ? (
          <svg
            className="yt-video-analytics-overview__chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Daily views"
          >
            <polyline points={polyline} />
          </svg>
        ) : (
          <p className="yt-video-analytics-overview__empty">
            No daily views in this period.
          </p>
        )}
        <section className="yt-video-analytics-overview__top" aria-label="Top content">
          <h4 className="yt-video-analytics-overview__section-title">
            Your top content in this period.
          </h4>
          {topVideos.length === 0 ? (
            <p className="yt-video-analytics-overview__empty">
              No videos ranked in this period.
            </p>
          ) : (
            <ol className="yt-video-analytics-overview__list">
              {topVideos.map((video, index) => {
                const percent = formatViewPercentage(video.average_view_percentage);
                const avd = formatAverageViewDuration(
                  video.average_view_duration_seconds,
                );
                return (
                  <li key={video.video_id || `top-${index}`}>
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt="" />
                    ) : null}
                    <span>{video.title || "Untitled"}</span>
                    <span>
                      {avd}
                      {percent ? ` (${percent})` : ""}
                    </span>
                    <span>
                      {typeof video.views === "number" ? video.views : "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
      <aside className="yt-video-analytics-overview__latest">
        <h4 className="yt-video-analytics-overview__section-title">Latest content</h4>
        {latestRow ? (
          <>
            {latestRow.thumbnail ? (
              <img src={latestRow.thumbnail} alt="" />
            ) : null}
            <p className="yt-video-analytics-overview__latest-title">
              {latestRow.title || "Untitled"}
            </p>
            <div className="yt-rail-stat-row">
              <span className="yt-rail-stat-label">Views</span>
              <span className="yt-rail-stat-value">
                {typeof latestRow.view_count === "number" ? latestRow.view_count : "—"}
              </span>
            </div>
            <div className="yt-rail-stat-row">
              <span className="yt-rail-stat-label">Likes</span>
              <span className="yt-rail-stat-value">
                {typeof latestRow.like_count === "number" ? latestRow.like_count : "—"}
              </span>
            </div>
            {latest.length > 1 ? (
              <div className="yt-video-analytics-overview__pager">
                <button
                  type="button"
                  className="yt-rail-btn"
                  aria-label="Previous latest video"
                  disabled={safeIndex === 0}
                  onClick={() => setLatestIndex((index) => Math.max(0, index - 1))}
                >
                  Previous
                </button>
                <span>
                  {safeIndex + 1} of {latest.length}
                </span>
                <button
                  type="button"
                  className="yt-rail-btn"
                  aria-label="Next latest video"
                  disabled={safeIndex >= latest.length - 1}
                  onClick={() =>
                    setLatestIndex((index) => Math.min(latest.length - 1, index + 1))
                  }
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="yt-video-analytics-overview__empty">No recent uploads.</p>
        )}
      </aside>
    </div>
  );
};
