/**
 * Hub search results panel — Search.list titles + filter chips + Filters icon.
 * Embed/iframe is intentionally omitted; titles still open youtube.com.
 */
import React, { useEffect, useState } from "react";
import { YOUTUBE_STUDIO_OVERLAY_TIERS } from "./youtubeStudioZIndex";
import {
  YouTubeSearchTypeFilters,
  type YouTubeSearchTypeFilter,
} from "./YouTubeSearchTypeFilters";
import {
  YouTubeSearchDurationFilters,
  type YouTubeSearchDurationFilter,
} from "./YouTubeSearchDurationFilters";
import "./youtubeSearchResultsPanel.css";

export type YouTubeSearchFilter = "all" | "videos" | "shorts" | "recent" | "live";
export type { YouTubeSearchTypeFilter, YouTubeSearchDurationFilter };

export type YouTubeSearchHit = {
  video_id?: string;
  channel_id?: string;
  playlist_id?: string;
  title: string;
};

const FILTER_CHIPS: Array<{ id: YouTubeSearchFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "videos", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "recent", label: "Recently uploaded" },
  { id: "live", label: "Live" },
];

/** Search.list has no Shorts type; keep titles that use documented Shorts hashtags. */
const SHORTS_HASHTAG = /#(?:shorts|youtubeshorts|shortvideo)\b/i;

export function isYouTubeShortsTitle(title: string): boolean {
  try {
    return SHORTS_HASHTAG.test(String(title || ""));
  } catch (error) {
    console.error("[YouTubeSearchResultsPanel] Shorts title check failed", error);
    return false;
  }
}

export interface YouTubeSearchResultsPanelProps {
  isOpen: boolean;
  items: YouTubeSearchHit[];
  message?: string | null;
  selectedFilter?: YouTubeSearchFilter;
  selectedType?: YouTubeSearchTypeFilter;
  selectedDuration?: YouTubeSearchDurationFilter;
  onFilterChange?: (filter: YouTubeSearchFilter) => void;
  onTypeChange?: (type: YouTubeSearchTypeFilter) => void;
  onDurationChange?: (duration: YouTubeSearchDurationFilter) => void;
  onClose?: () => void;
}

export function decodeYouTubeSnippetTitle(raw: string): string {
  try {
    const el = document.createElement("textarea");
    el.innerHTML = raw;
    return el.value;
  } catch (error) {
    console.error("[YouTubeSearchResultsPanel] Failed to decode title", error);
    return raw;
  }
}

function youtubeSearchHitKey(hit: YouTubeSearchHit): string {
  return hit.video_id || hit.channel_id || hit.playlist_id || hit.title;
}

function youtubeSearchHitHref(hit: YouTubeSearchHit): string | null {
  if (hit.channel_id) {
    return `https://www.youtube.com/channel/${hit.channel_id}`;
  }
  if (hit.playlist_id) {
    return `https://www.youtube.com/playlist?list=${hit.playlist_id}`;
  }
  if (hit.video_id) {
    return `https://www.youtube.com/watch?v=${hit.video_id}`;
  }
  return null;
}

const FiltersSlidersIcon: React.FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="4" y1="8" x2="20" y2="8" />
    <circle cx="16" cy="8" r="2.5" fill="currentColor" stroke="none" />
    <line x1="4" y1="16" x2="20" y2="16" />
    <circle cx="8" cy="16" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const YouTubeSearchResultsPanel: React.FC<YouTubeSearchResultsPanelProps> = ({
  isOpen,
  items,
  message = null,
  selectedFilter = "all",
  selectedType,
  selectedDuration,
  onFilterChange,
  onTypeChange,
  onDurationChange,
  onClose,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const closeSearchFilters = (
    source: string,
    meta?: Record<string, string>,
  ) => {
    try {
      setFiltersOpen(false);
      console.info("[YouTubeSearchResultsPanel] Search filters closed", {
        source,
        ...meta,
      });
    } catch (error) {
      console.error(
        "[YouTubeSearchResultsPanel] Search filters close failed",
        { source, ...meta },
        error,
      );
    }
  };

  const applyTypeAndClose = (type: YouTubeSearchTypeFilter) => {
    try {
      console.info("[YouTubeSearchResultsPanel] TYPE filter selected", {
        searchType: type,
      });
      onTypeChange?.(type);
    } catch (error) {
      console.error(
        "[YouTubeSearchResultsPanel] TYPE filter apply failed",
        { searchType: type },
        error,
      );
    }
    closeSearchFilters("type", { searchType: type });
  };

  const applyDurationAndClose = (duration: YouTubeSearchDurationFilter) => {
    try {
      console.info("[YouTubeSearchResultsPanel] Duration filter selected", {
        videoDuration: duration,
      });
      onDurationChange?.(duration);
    } catch (error) {
      console.error(
        "[YouTubeSearchResultsPanel] Duration filter apply failed",
        { videoDuration: duration },
        error,
      );
    }
    closeSearchFilters("duration", { videoDuration: duration });
  };

  useEffect(() => {
    if (!isOpen) {
      try {
        setFiltersOpen(false);
      } catch (error) {
        console.error(
          "[YouTubeSearchResultsPanel] Failed to reset Search filters",
          error,
        );
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <section
      className="yt-search-results-panel"
      role="region"
      aria-label="YouTube search results"
      style={{ zIndex: YOUTUBE_STUDIO_OVERLAY_TIERS.hubToolbar }}
    >
      <div className="yt-search-results-panel__header">
        <div className="yt-search-results-panel__chips" role="toolbar" aria-label="Search chips">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={
                chip.id === selectedFilter
                  ? "yt-search-results-panel__chip yt-search-results-panel__chip--active"
                  : "yt-search-results-panel__chip"
              }
              aria-pressed={chip.id === selectedFilter}
              onClick={() => {
                try {
                  onFilterChange?.(chip.id);
                } catch (error) {
                  console.error("[YouTubeSearchResultsPanel] Filter change failed", error);
                }
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="yt-search-results-panel__filters"
          aria-expanded={filtersOpen}
          onClick={() => {
            try {
              const nextOpen = !filtersOpen;
              setFiltersOpen(nextOpen);
              console.info("[YouTubeSearchResultsPanel] Filters toggled", {
                nextOpen,
              });
            } catch (error) {
              console.error("[YouTubeSearchResultsPanel] Filters toggle failed", error);
            }
          }}
        >
          Filters
          <FiltersSlidersIcon />
        </button>
        {onClose ? (
          <button
            type="button"
            className="yt-search-results-panel__close"
            aria-label="Close search results"
            onClick={() => {
              try {
                onClose();
              } catch (error) {
                console.error("[YouTubeSearchResultsPanel] Close failed", error);
              }
            }}
          >
            Close
          </button>
        ) : null}
      </div>
      {filtersOpen ? (
        <div
          className="yt-search-filters-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yt-search-filters-title"
        >
          <div className="yt-search-filters-dialog__header">
            <h2 id="yt-search-filters-title" className="yt-search-filters-dialog__title">
              Search filters
            </h2>
            <button
              type="button"
              className="yt-search-results-panel__close"
              aria-label="Close search filters"
              onClick={() => closeSearchFilters("close-control")}
            >
              ×
            </button>
          </div>
          <div className="yt-search-filters-dialog__columns">
            <YouTubeSearchTypeFilters
              selectedType={selectedType}
              onTypeChange={applyTypeAndClose}
            />
            <YouTubeSearchDurationFilters
              selectedDuration={selectedDuration}
              onDurationChange={applyDurationAndClose}
            />
            {/* Upload date, Features, Prioritise — later slices */}
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="yt-search-results-panel__status" role="status">
          {message}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="yt-search-results-panel__list">
          {items.map((hit) => {
            const href = youtubeSearchHitHref(hit);
            if (!href) {
              console.warn(
                "[YouTubeSearchResultsPanel] Skipping search hit without id",
              );
              return null;
            }
            return (
              <li key={youtubeSearchHitKey(hit)}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {decodeYouTubeSnippetTitle(hit.title)}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};
