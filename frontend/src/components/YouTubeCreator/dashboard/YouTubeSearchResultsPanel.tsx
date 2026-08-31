/**
 * Hub search results panel — Search.list titles + filter chips.
 * Embed/iframe is intentionally omitted; titles still open youtube.com.
 */
import React from "react";
import { YOUTUBE_STUDIO_OVERLAY_TIERS } from "./youtubeStudioZIndex";
import "./youtubeSearchResultsPanel.css";

export type YouTubeSearchFilter = "all" | "videos" | "shorts" | "recent" | "live";

export type YouTubeSearchHit = {
  video_id: string;
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
  onFilterChange?: (filter: YouTubeSearchFilter) => void;
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

export const YouTubeSearchResultsPanel: React.FC<YouTubeSearchResultsPanelProps> = ({
  isOpen,
  items,
  message = null,
  selectedFilter = "all",
  onFilterChange,
  onClose,
}) => {
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
        <div className="yt-search-results-panel__chips" role="toolbar" aria-label="Search filters">
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
      {message ? (
        <p className="yt-search-results-panel__status" role="status">
          {message}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="yt-search-results-panel__list">
          {items.map((hit) => (
            <li key={hit.video_id}>
              <a
                href={`https://www.youtube.com/watch?v=${hit.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {decodeYouTubeSnippetTitle(hit.title)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
