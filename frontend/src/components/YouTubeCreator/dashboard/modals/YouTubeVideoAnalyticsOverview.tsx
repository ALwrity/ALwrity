import React, { useState } from "react";
import { YouTubeVideoAnalyticsOverviewChart } from "./YouTubeVideoAnalyticsOverviewChart";
import {
  formatAverageViewDuration,
  formatOverviewHeadline,
  formatSubscriberNet,
  formatViewPercentage,
  formatWatchHours,
  previousPeriodChangeLabel,
  type OverviewHeadlineWindow,
} from "../youtubeVideoAnalyticsOverviewStats";
import type { YouTubeAnalyticsDateSelection } from "../youtubeVideoAnalyticsDateRange";
import type {
  OverviewChartMetric,
  YouTubeOverviewDayPoint,
} from "../youtubeVideoAnalyticsChartScale";
import "../youtubeVideoAnalyticsOverview.css";

export type YouTubeChannelOverviewPayload = {
  success?: boolean;
  error_code?: string | null;
  message?: string;
  compare?: boolean;
  published_at?: string | null;
  window_kind?: string | null;
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
  views_by_day?: YouTubeOverviewDayPoint[];
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

const METRIC_TABS: ReadonlyArray<{ id: OverviewChartMetric; label: string }> = [
  { id: "views", label: "Views" },
  { id: "watch_hours", label: "Watch time (hours)" },
  { id: "subscribers_net", label: "Subscribers" },
];

function headlineWindow(selection: YouTubeAnalyticsDateSelection): OverviewHeadlineWindow {
  if (selection.type === "rolling") {
    return { kind: "rolling", days: selection.days };
  }
  if (selection.type === "lifetime") {
    return { kind: "lifetime" };
  }
  if (selection.type === "year") {
    return { kind: "year", year: selection.year };
  }
  if (selection.type === "month") {
    return { kind: "month", year: selection.year, month: selection.month };
  }
  return { kind: "custom" };
}

function comparePeriod(
  selection: YouTubeAnalyticsDateSelection,
  payload: YouTubeChannelOverviewPayload | null,
): { mode: "days" | "period" | "none"; days?: number } {
  if (selection.type === "lifetime" || payload?.compare === false) {
    return { mode: "none" };
  }
  if (selection.type === "rolling") {
    return { mode: "days", days: selection.days };
  }
  return { mode: "period" };
}

export const YouTubeVideoAnalyticsOverview: React.FC<{
  selection: YouTubeAnalyticsDateSelection;
  payload: YouTubeChannelOverviewPayload | null;
  status: string | null;
}> = ({ selection, payload, status }) => {
  const [latestIndex, setLatestIndex] = useState(0);
  const [metric, setMetric] = useState<OverviewChartMetric>("views");
  const current = payload?.current;
  const previous = payload?.previous;
  const daySeries = payload?.views_by_day || [];
  const topVideos = payload?.top_videos || [];
  const latest = payload?.latest_videos || [];
  const safeIndex = latest.length === 0 ? 0 : Math.min(latestIndex, latest.length - 1);
  const latestRow = latest[safeIndex];
  const delta = comparePeriod(selection, payload);
  const headline = headlineWindow(selection);

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
          {formatOverviewHeadline(current?.views, headline)}
        </h3>
        <div className="yt-video-analytics-overview__panel">
        <div
          className="yt-video-analytics-overview__cards"
          role="tablist"
          aria-label="Overview metrics"
        >
          {METRIC_TABS.map((tab) => {
            const selected = tab.id === metric;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={
                  selected
                    ? "yt-video-analytics-overview__card yt-video-analytics-overview__card--active"
                    : "yt-video-analytics-overview__card"
                }
                aria-selected={selected}
                aria-controls="yt-video-analytics-overview-chart"
                onClick={() => {
                  if (tab.id === metric) {
                    return;
                  }
                  console.info("[YouTubeVideoAnalytics] Chart metric", { metric: tab.id });
                  setMetric(tab.id);
                }}
              >
                <span className="yt-rail-stat-label">{tab.label}</span>
                <span className="yt-rail-stat-value">
                  {tab.id === "views"
                    ? typeof current?.views === "number"
                      ? current.views
                      : "—"
                    : tab.id === "watch_hours"
                      ? formatWatchHours(current?.watch_hours)
                      : formatSubscriberNet(current?.subscribers_net)}
                </span>
                <span className="yt-video-analytics-overview__delta">
                  {tab.id === "views"
                    ? previousPeriodChangeLabel(current?.views, previous?.views, delta)
                    : tab.id === "watch_hours"
                      ? previousPeriodChangeLabel(
                          current?.watch_hours,
                          previous?.watch_hours,
                          delta,
                        )
                      : previousPeriodChangeLabel(
                          current?.subscribers_net,
                          previous?.subscribers_net,
                          delta,
                        )}
                </span>
              </button>
            );
          })}
        </div>
        <YouTubeVideoAnalyticsOverviewChart series={daySeries} metric={metric} />
        </div>
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
