import React, { useEffect, useMemo, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";
import {
  YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET,
  YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
  YOUTUBE_VIDEO_ANALYTICS_PRESETS,
  YOUTUBE_VIDEO_ANALYTICS_TABS,
  emptyAnalyticsPanelCopy,
  formatAnalyticsDateRange,
  formatAnalyticsPresetLabel,
  nextAnalyticsTab,
  type YouTubeVideoAnalyticsPresetId,
  type YouTubeVideoAnalyticsTabId,
} from "../youtubeVideoAnalyticsUi";
import "../youtubeVideoAnalyticsLayout.css";

export const YouTubeVideoAnalyticsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [tab, setTab] = useState<YouTubeVideoAnalyticsTabId>(
    YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
  );
  const [preset, setPreset] = useState<YouTubeVideoAnalyticsPresetId>(
    YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET,
  );
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const today = useMemo(() => new Date(), [open]);
  const rangeLabel = formatAnalyticsDateRange(preset, today);
  const presetLabel = formatAnalyticsPresetLabel(preset);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTab(YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB);
    setPreset(YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET);
    setDateMenuOpen(false);
    console.info("[YouTubeVideoAnalytics] Open", {
      tab: YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
      preset: YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET,
    });
  }, [open]);

  const onSelectTab = (next: YouTubeVideoAnalyticsTabId) => {
    if (next === tab) {
      return;
    }
    console.info("[YouTubeVideoAnalytics] Tab changed", { tab: next });
    setTab(next);
  };

  const onSelectPreset = (next: YouTubeVideoAnalyticsPresetId) => {
    console.info("[YouTubeVideoAnalytics] Range changed", { preset: next });
    setPreset(next);
    setDateMenuOpen(false);
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Video analytics"
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      <div className="yt-video-analytics-toolbar">
        <div
          className="yt-video-analytics-tabs"
          role="tablist"
          aria-label="Video analytics sections"
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
              return;
            }
            event.preventDefault();
            onSelectTab(
              nextAnalyticsTab(tab, event.key === "ArrowRight" ? 1 : -1),
            );
          }}
        >
          {YOUTUBE_VIDEO_ANALYTICS_TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`yt-video-analytics-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`yt-video-analytics-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                className={
                  selected
                    ? "yt-video-analytics-tab yt-video-analytics-tab--active"
                    : "yt-video-analytics-tab"
                }
                onClick={() => onSelectTab(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          className="yt-video-analytics-date"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !dateMenuOpen) {
              return;
            }
            event.stopPropagation();
            setDateMenuOpen(false);
          }}
        >
          <button
            type="button"
            className="yt-video-analytics-date__button"
            aria-label="Analytics date range"
            aria-haspopup="listbox"
            aria-expanded={dateMenuOpen}
            onClick={() => setDateMenuOpen((current) => !current)}
          >
            <span className="yt-video-analytics-date__range">{rangeLabel}</span>
            <span className="yt-video-analytics-date__preset">{presetLabel}</span>
          </button>
          {dateMenuOpen ? (
            <ul className="yt-video-analytics-date__menu" role="listbox" aria-label="Date range">
              {YOUTUBE_VIDEO_ANALYTICS_PRESETS.map((item) => (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className="yt-video-analytics-date__option"
                    aria-selected={item.id === preset}
                    onClick={() => onSelectPreset(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div
        className="yt-video-analytics-panel"
        role="tabpanel"
        id={`yt-video-analytics-panel-${tab}`}
        aria-labelledby={`yt-video-analytics-tab-${tab}`}
      >
        {emptyAnalyticsPanelCopy(tab)}
      </div>
    </YouTubeActionModal>
  );
};
