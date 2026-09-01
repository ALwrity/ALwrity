/**
 * Search filters DURATION column — Under 4 minutes, 4–20 minutes, Over 20 minutes.
 * Search.list videoDuration: short / medium / long (requires type=video).
 * Duration short is not TYPE/chip Shorts — no #shorts hashtag keep.
 */
import React from "react";
import "./youtubeSearchDurationFilters.css";

export type YouTubeSearchDurationFilter = "short" | "medium" | "long";

const DURATION_OPTIONS: Array<{ id: YouTubeSearchDurationFilter; label: string }> = [
  { id: "short", label: "Under 4 minutes" },
  { id: "medium", label: "4–20 minutes" },
  { id: "long", label: "Over 20 minutes" },
];

export interface YouTubeSearchDurationFiltersProps {
  selectedDuration?: YouTubeSearchDurationFilter;
  onDurationChange?: (duration: YouTubeSearchDurationFilter) => void;
}

export const YouTubeSearchDurationFilters: React.FC<YouTubeSearchDurationFiltersProps> = ({
  selectedDuration,
  onDurationChange,
}) => {
  return (
    <div className="yt-search-duration-filters" role="group" aria-label="Duration">
      <p className="yt-search-duration-filters__heading">DURATION</p>
      {DURATION_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={
            option.id === selectedDuration
              ? "yt-search-duration-filters__option yt-search-duration-filters__option--active"
              : "yt-search-duration-filters__option"
          }
          aria-pressed={option.id === selectedDuration}
          onClick={() => {
            try {
              console.info("[YouTubeSearchDurationFilters] Duration selected", {
                videoDuration: option.id,
              });
              onDurationChange?.(option.id);
            } catch (error) {
              console.error(
                "[YouTubeSearchDurationFilters] Duration change failed",
                { videoDuration: option.id },
                error,
              );
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
