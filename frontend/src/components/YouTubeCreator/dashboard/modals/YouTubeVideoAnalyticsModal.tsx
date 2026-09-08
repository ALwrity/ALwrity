import React, { useEffect, useMemo, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";
import {
  YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
  YOUTUBE_VIDEO_ANALYTICS_TABS,
  YOUTUBE_VIDEO_ANALYTICS_WINDOW_UNSUPPORTED,
  emptyAnalyticsPanelCopy,
  nextAnalyticsTab,
  type YouTubeVideoAnalyticsTabId,
} from "../youtubeVideoAnalyticsUi";
import {
  YOUTUBE_ANALYTICS_DEFAULT_SELECTION,
  formatSelectionRange,
  selectionLabel,
  toOverviewRequest,
  type YouTubeAnalyticsDateSelection,
} from "../youtubeVideoAnalyticsDateRange";
import { YouTubeVideoAnalyticsDateMenu } from "./YouTubeVideoAnalyticsDateMenu";
import {
  YouTubeVideoAnalyticsOverview,
  type YouTubeChannelOverviewPayload,
} from "./YouTubeVideoAnalyticsOverview";
import "../youtubeVideoAnalyticsLayout.css";

const OVERVIEW_LOAD_FAILED = "Channel overview request failed.";

export const YouTubeVideoAnalyticsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [tab, setTab] = useState<YouTubeVideoAnalyticsTabId>(
    YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
  );
  const [selection, setSelection] = useState<YouTubeAnalyticsDateSelection>(
    YOUTUBE_ANALYTICS_DEFAULT_SELECTION,
  );
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [overviewPayload, setOverviewPayload] =
    useState<YouTubeChannelOverviewPayload | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<string | null>(null);
  const today = useMemo(() => new Date(), [open]);
  const rangeLabel = formatSelectionRange(selection, today);
  const presetLabel = selectionLabel(selection);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTab(YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB);
    setSelection(YOUTUBE_ANALYTICS_DEFAULT_SELECTION);
    setDateMenuOpen(false);
    console.info("[YouTubeVideoAnalytics] Open", {
      tab: YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB,
      preset: YOUTUBE_ANALYTICS_DEFAULT_SELECTION.id,
    });
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "overview") {
      return;
    }
    const params = toOverviewRequest(selection, today);
    if (!params) {
      setOverviewPayload(null);
      setOverviewStatus(YOUTUBE_VIDEO_ANALYTICS_WINDOW_UNSUPPORTED);
      console.info("[YouTubeVideoAnalytics] Overview skipped", {
        reason: "window_unsupported",
      });
      return;
    }
    let cancelled = false;
    setOverviewPayload(null);
    setOverviewStatus("Loading channel overview.");
    console.info("[YouTubeVideoAnalytics] Overview start", {
      window: params.window,
      days: params.days,
      hasStartDate: Boolean(params.start_date),
      hasEndDate: Boolean(params.end_date),
    });
    youtubeStudioApi
      .getChannelOverview(params)
      .then((payload: YouTubeChannelOverviewPayload) => {
        if (cancelled) {
          return;
        }
        if (!payload?.success) {
          console.warn("[YouTubeVideoAnalytics] Overview unsuccessful", {
            errorCode: payload?.error_code || "unavailable",
            window: params.window,
          });
          setOverviewPayload(payload || null);
          setOverviewStatus(payload?.message || OVERVIEW_LOAD_FAILED);
          return;
        }
        console.info("[YouTubeVideoAnalytics] Overview complete", {
          window: params.window,
          dayCount: Array.isArray(payload.views_by_day) ? payload.views_by_day.length : 0,
          topCount: Array.isArray(payload.top_videos) ? payload.top_videos.length : 0,
          latestCount: Array.isArray(payload.latest_videos)
            ? payload.latest_videos.length
            : 0,
        });
        setOverviewPayload(payload);
        setOverviewStatus(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error("[YouTubeVideoAnalytics] Overview failed", {
          errorName: loadError instanceof Error ? loadError.name : "Error",
          window: params.window,
        });
        setOverviewPayload(null);
        setOverviewStatus(OVERVIEW_LOAD_FAILED);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab, selection, today]);

  const onSelectTab = (next: YouTubeVideoAnalyticsTabId) => {
    if (next === tab) {
      return;
    }
    console.info("[YouTubeVideoAnalytics] Tab changed", { tab: next });
    setTab(next);
  };

  const onSelectRange = (next: YouTubeAnalyticsDateSelection) => {
    console.info("[YouTubeVideoAnalytics] Range changed", {
      preset: next.id,
      type: next.type,
    });
    setSelection(next);
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
            <YouTubeVideoAnalyticsDateMenu
              selection={selection}
              today={today}
              onSelect={onSelectRange}
              onCancel={() => {
                console.info("[YouTubeVideoAnalytics] Date menu closed", {
                  reason: "custom_cancel",
                });
                setDateMenuOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>
      <div
        className="yt-video-analytics-panel"
        role="tabpanel"
        id={`yt-video-analytics-panel-${tab}`}
        aria-labelledby={`yt-video-analytics-tab-${tab}`}
      >
        {tab === "overview" ? (
          <YouTubeVideoAnalyticsOverview
            key={selection.id}
            selection={selection}
            payload={overviewPayload}
            status={overviewStatus}
          />
        ) : (
          emptyAnalyticsPanelCopy(tab)
        )}
      </div>
    </YouTubeActionModal>
  );
};
