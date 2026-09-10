import React, { useState } from "react";
import { formatWatchHours } from "../youtubeVideoAnalyticsOverviewStats";
import {
  ageGroupLabel,
  countryRowLabel,
  deviceTypeLabel,
  formatViewerPercent,
  genderLabel,
  subscribedStatusLabel,
  viewerPercentBarWidth,
  audienceHubSectionLabel,
  YOUTUBE_AUDIENCE_HUB_SECTIONS,
  type YouTubeAudienceHubSectionId,
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
  devices?: YouTubeAudienceSection<{
    device_type?: string;
    views?: number | null;
    watch_hours?: number | null;
    watch_share_percent?: number | null;
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
  const [section, setSection] = useState<YouTubeAudienceHubSectionId>(
    "demographics",
  );

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
  const deviceRows = payload.devices?.rows || [];
  const subscribed = payload.subscribed;
  const subscribedRowData = subscribedRow(subscribed, "SUBSCRIBED");
  const unsubscribedRowData = subscribedRow(subscribed, "UNSUBSCRIBED");

  const selectSection = (next: YouTubeAudienceHubSectionId) => {
    if (next === section) {
      return;
    }
    console.info("[YouTubeVideoAnalytics] Audience section", { section: next });
    setSection(next);
  };

  return (
    <div className="yt-video-analytics-audience">
      <div
        className="yt-video-analytics-audience__chips"
        role="group"
        aria-label="Audience sections"
      >
        {YOUTUBE_AUDIENCE_HUB_SECTIONS.map((item) => {
          const active = item.id === section;
          const tipId = `yt-video-analytics-audience-tip-${item.id}`;
          return (
            <span key={item.id} className="yt-video-analytics-audience__chip-wrap">
              <button
                type="button"
                className={
                  active
                    ? "yt-video-analytics-audience__chip yt-video-analytics-audience__chip--active"
                    : "yt-video-analytics-audience__chip"
                }
                aria-pressed={active}
                aria-describedby={tipId}
                data-tooltip={item.tooltip}
                onClick={() => selectSection(item.id)}
              >
                {item.label}
              </button>
              <span id={tipId} className="yt-video-analytics-audience__chip-tip">
                {item.tooltip}
              </span>
            </span>
          );
        })}
      </div>
      {section === "demographics" ? (
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-demo"
      >
        <h3
          id="yt-video-analytics-audience-demo"
          className="yt-video-analytics-audience__title"
        >
          {audienceHubSectionLabel("demographics")}
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
      ) : null}
      {section === "countries" ? (
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-countries"
      >
        <h3
          id="yt-video-analytics-audience-countries"
          className="yt-video-analytics-audience__title"
        >
          {audienceHubSectionLabel("countries")}
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
      ) : null}
      {section === "subscribed" ? (
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-subscribed"
      >
        <h3
          id="yt-video-analytics-audience-subscribed"
          className="yt-video-analytics-audience__title"
        >
          {audienceHubSectionLabel("subscribed")}
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
      ) : null}
      {section === "devices" ? (
      <section
        className="yt-video-analytics-audience__panel"
        aria-labelledby="yt-video-analytics-audience-devices"
      >
        <h3
          id="yt-video-analytics-audience-devices"
          className="yt-video-analytics-audience__title"
        >
          {audienceHubSectionLabel("devices")}
        </h3>
        <p className="yt-video-analytics-audience__subtitle">Watch time (hours)</p>
        {deviceRows.length === 0 ? (
          <p className="yt-video-analytics-audience__empty">
            {sectionMessage(payload.devices, "No device data in this period.")}
          </p>
        ) : (
          <>
            <div
              className="yt-video-analytics-audience__stack"
              role="img"
              aria-label="Watch time by device"
            >
              {deviceRows.map((row, index) => (
                <span
                  key={`${row.device_type}-${index}`}
                  className="yt-video-analytics-audience__stack-seg"
                  style={{
                    flexGrow:
                      typeof row.watch_share_percent === "number"
                        ? row.watch_share_percent
                        : 0,
                  }}
                />
              ))}
            </div>
            <ul className="yt-video-analytics-audience__legend">
              {deviceRows.map((row, index) => (
                <li key={`${row.device_type}-legend-${index}`}>
                  <span className="yt-video-analytics-audience__swatch" />
                  <span>{deviceTypeLabel(row.device_type || "")}</span>
                  <span>{formatViewerPercent(row.watch_share_percent)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      ) : null}
    </div>
  );
};
