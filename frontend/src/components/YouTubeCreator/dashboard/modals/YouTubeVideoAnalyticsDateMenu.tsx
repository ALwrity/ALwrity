import React, { useMemo, useState } from "react";
import {
  analyticsMonthOptions,
  analyticsYearOptions,
  defaultCustomRange,
  isoDay,
  monthLabel,
  openNativeDatePicker,
  validateCustomRange,
  type YouTubeAnalyticsDateSelection,
} from "../youtubeVideoAnalyticsDateRange";
import { YOUTUBE_VIDEO_ANALYTICS_PRESETS } from "../youtubeVideoAnalyticsUi";
import "../youtubeVideoAnalyticsDateMenu.css";

const ROLLING_AND_LIFETIME = YOUTUBE_VIDEO_ANALYTICS_PRESETS;

function rollingSelection(
  id: (typeof ROLLING_AND_LIFETIME)[number]["id"],
): YouTubeAnalyticsDateSelection {
  if (id === "lifetime") {
    return { type: "lifetime", id: "lifetime" };
  }
  const match = ROLLING_AND_LIFETIME.find((row) => row.id === id);
  const days = (match?.days || 28) as 7 | 28 | 90 | 365;
  return { type: "rolling", id: id as "last_7" | "last_28" | "last_90" | "last_365", days };
}

export const YouTubeVideoAnalyticsDateMenu: React.FC<{
  selection: YouTubeAnalyticsDateSelection;
  today: Date;
  onSelect: (next: YouTubeAnalyticsDateSelection) => void;
  onCancel: () => void;
}> = ({ selection, today, onSelect, onCancel }) => {
  const years = useMemo(() => analyticsYearOptions(today), [today]);
  const months = useMemo(() => analyticsMonthOptions(today), [today]);
  const defaults = useMemo(() => defaultCustomRange(today), [today]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState(
    selection.type === "custom" ? selection.start : defaults.start,
  );
  const [customEnd, setCustomEnd] = useState(
    selection.type === "custom" ? selection.end : defaults.end,
  );
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const maxDay = isoDay(today);

  const selectedKey = selection.id;

  const onApplyCustom = () => {
    const result = validateCustomRange(customStart, customEnd, today);
    if (!result.ok) {
      setCustomMessage(result.message);
      console.warn("[YouTubeVideoAnalytics] Custom range invalid", {
        reason: "invalid_custom_range",
      });
      return;
    }
    setCustomMessage(null);
    onSelect({ type: "custom", id: "custom", start: result.start, end: result.end });
  };

  if (customOpen) {
    return (
      <div
        className="yt-video-analytics-date__menu yt-video-analytics-date__menu--custom"
        role="group"
        aria-label="Custom date range"
      >
        <div className="yt-video-analytics-date__custom">
          <label className="yt-video-analytics-date__custom-label">
            Start date
            <input
              type="date"
              value={customStart}
              max={maxDay}
              onChange={(event) => setCustomStart(event.target.value)}
              onFocus={(event) => openNativeDatePicker(event.currentTarget)}
              onClick={(event) => openNativeDatePicker(event.currentTarget)}
            />
          </label>
          <label className="yt-video-analytics-date__custom-label">
            End date
            <input
              type="date"
              value={customEnd}
              max={maxDay}
              onChange={(event) => setCustomEnd(event.target.value)}
              onFocus={(event) => openNativeDatePicker(event.currentTarget)}
              onClick={(event) => openNativeDatePicker(event.currentTarget)}
            />
          </label>
          {customMessage ? (
            <p className="yt-video-analytics-date__custom-error">{customMessage}</p>
          ) : null}
          <div className="yt-video-analytics-date__custom-actions">
            <button type="button" className="yt-rail-btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="yt-rail-btn yt-rail-btn--primary"
              onClick={onApplyCustom}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="yt-video-analytics-date__menu" role="listbox" aria-label="Date range">
      {ROLLING_AND_LIFETIME.map((item) => (
        <button
          key={item.id}
          type="button"
          role="option"
          className="yt-video-analytics-date__option"
          aria-selected={selectedKey === item.id}
          onClick={() => onSelect(rollingSelection(item.id))}
        >
          {item.label}
        </button>
      ))}
      <div className="yt-video-analytics-date__rule" />
      {years.map((year) => {
        const id = `year-${year}`;
        return (
          <button
            key={id}
            type="button"
            role="option"
            className="yt-video-analytics-date__option"
            aria-selected={selectedKey === id}
            onClick={() => onSelect({ type: "year", id, year })}
          >
            {year}
          </button>
        );
      })}
      <div className="yt-video-analytics-date__rule" />
      {months.map((row) => {
        const id = `month-${row.year}-${row.month}`;
        return (
          <button
            key={id}
            type="button"
            role="option"
            className="yt-video-analytics-date__option"
            aria-selected={selectedKey === id}
            onClick={() => onSelect({ type: "month", id, year: row.year, month: row.month })}
          >
            {monthLabel(row.month)}
          </button>
        );
      })}
      <div className="yt-video-analytics-date__rule" />
      <button
        type="button"
        role="option"
        className="yt-video-analytics-date__option"
        aria-selected={selection.type === "custom"}
        onClick={() => {
          setCustomStart(selection.type === "custom" ? selection.start : defaults.start);
          setCustomEnd(selection.type === "custom" ? selection.end : defaults.end);
          setCustomMessage(null);
          setCustomOpen(true);
        }}
      >
        Custom
      </button>
    </div>
  );
};
