import React from "react";
import { formatWatchHours } from "../youtubeVideoAnalyticsOverviewStats";
import {
  ageGroupLabel,
  countryRowLabel,
  formatViewerPercent,
  genderLabel,
  subscribedStatusLabel,
  viewerPercentBarWidth,
} from "../youtubeVideoAnalyticsAudienceLabels";
import "../youtubeVideoAnalyticsAudience.css";

export type YouTubeAudienceSection<T> = {
  available?: boolean;
  rows?: T[];
  message?: string | null;
};

export type YouTubeChannelAudiencePayload = {
  success?: boolean;
  error_code?: string | null;
  message?: string;
  demographics?: YouTubeAudienceSection<{
    age_group?: string;
    gender?: string;
    viewer_percentage?: number | null;
  }>;
  countries?: YouTubeAudienceSection<{
    country?: string;
    label?: string;
    views?: number | null;
    watch_hours?: number | null;
  }>;
  subscribed?: YouTubeAudienceSection<{
    status?: string;
    views?: number | null;
    watch_hours?: number | null;
  }>;
};

function sectionMessage(
  section: YouTubeAudienceSection<unknown> | undefined,
  fallback: string,
): string {
  return section?.message || fallback;
}

function subscribedRow(
  rows: YouTubeChannelAudiencePayload["subscribed"],
  status: "SUBSCRIBED" | "UNSUBSCRIBED",
) {
  return (rows?.rows || []).find((row) => row.status === status);
}

export const YouTubeVideoAnalyticsAudience: React.FC<{
  payload: YouTubeChannelAudiencePayload | null;
  status: string | null;
}> = ({ payload, status }) => {
  if (status) {
    return <p className="yt-video-analytics-audience__status">{status}</p>;
  }
  if (!payload) {
    return (
      <p className="yt-video-analytics-audience__status">Loading channel audience.</p>
    );
  }
  if (!payload.success) {
    return (
      <p className="yt-video-analytics-audience__status">
        {payload.message || "Channel audience is unavailable for this window."}
      </p>
    );
  }

  const demoRows = payload.demographics?.rows || [];
  const countryRows = payload.countries?.rows || [];
  const subscribed = payload.subscribed;
  const subscribedRowData = subscribedRow(subscribed, "SUBSCRIBED");
  const unsubscribedRowData = subscribedRow(subscribed, "UNSUBSCRIBED");

  return (
    <div className="yt-video-analytics-audience">
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-demo"
      >
        <h3
          id="yt-video-analytics-audience-demo"
          className="yt-video-analytics-audience__title"
        >
          Age and gender
        </h3>
        {demoRows.length === 0 ? (
          <p className="yt-video-analytics-audience__empty">
            {sectionMessage(payload.demographics, "No demographic data in this period.")}
          </p>
        ) : (
          <table className="yt-video-analytics-audience__table">
            <thead>
              <tr>
                <th>Age</th>
                <th>Gender</th>
                <th>Share</th>
                <th> </th>
              </tr>
            </thead>
            <tbody>
              {demoRows.map((row, index) => (
                <tr key={`${row.age_group}-${row.gender}-${index}`}>
                  <td>{ageGroupLabel(row.age_group || "")}</td>
                  <td>{genderLabel(row.gender || "")}</td>
                  <td>{formatViewerPercent(row.viewer_percentage)}</td>
                  <td>
                    <span className="yt-video-analytics-audience__bar-track">
                      <span
                        className="yt-video-analytics-audience__bar"
                        style={{
                          width: `${viewerPercentBarWidth(row.viewer_percentage)}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-countries"
      >
        <h3
          id="yt-video-analytics-audience-countries"
          className="yt-video-analytics-audience__title"
        >
          Top countries
        </h3>
        {countryRows.length === 0 ? (
          <p className="yt-video-analytics-audience__empty">
            {sectionMessage(payload.countries, "No country data in this period.")}
          </p>
        ) : (
          <table className="yt-video-analytics-audience__table yt-video-analytics-audience__table--metrics">
            <thead>
              <tr>
                <th>Country</th>
                <th>Views</th>
                <th>Watch time (hours)</th>
              </tr>
            </thead>
            <tbody>
              {countryRows.map((row, index) => (
                <tr key={`${row.country}-${index}`}>
                  <td>{countryRowLabel(row)}</td>
                  <td>{typeof row.views === "number" ? row.views : "—"}</td>
                  <td>{formatWatchHours(row.watch_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-subscribed"
      >
        <h3
          id="yt-video-analytics-audience-subscribed"
          className="yt-video-analytics-audience__title"
        >
          Subscribers watching
        </h3>
        {!(subscribed?.available) || (subscribed.rows || []).length === 0 ? (
          <p className="yt-video-analytics-audience__empty">
            {sectionMessage(
              subscribed,
              "No subscribed-viewer data in this period.",
            )}
          </p>
        ) : (
          <div className="yt-video-analytics-audience__kpis">
            <div className="yt-video-analytics-audience__kpi">
              <span className="yt-video-analytics-audience__kpi-title">
                {subscribedStatusLabel("SUBSCRIBED")}
              </span>
              <div className="yt-rail-stat-row">
                <span className="yt-rail-stat-label">Views</span>
                <span className="yt-rail-stat-value">
                  {typeof subscribedRowData?.views === "number"
                    ? subscribedRowData.views
                    : "—"}
                </span>
              </div>
              <div className="yt-rail-stat-row">
                <span className="yt-rail-stat-label">Watch time (hours)</span>
                <span className="yt-rail-stat-value">
                  {formatWatchHours(subscribedRowData?.watch_hours)}
                </span>
              </div>
            </div>
            <div className="yt-video-analytics-audience__kpi">
              <span className="yt-video-analytics-audience__kpi-title">
                {subscribedStatusLabel("UNSUBSCRIBED")}
              </span>
              <div className="yt-rail-stat-row">
                <span className="yt-rail-stat-label">Views</span>
                <span className="yt-rail-stat-value">
                  {typeof unsubscribedRowData?.views === "number"
                    ? unsubscribedRowData.views
                    : "—"}
                </span>
              </div>
              <div className="yt-rail-stat-row">
                <span className="yt-rail-stat-label">Watch time (hours)</span>
                <span className="yt-rail-stat-value">
                  {formatWatchHours(unsubscribedRowData?.watch_hours)}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
