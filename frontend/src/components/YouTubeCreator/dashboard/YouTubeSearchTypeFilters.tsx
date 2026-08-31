/**
 * Search filters TYPE column — Videos, Shorts, Channels, Playlists, Movies.
 * Duration / Upload date / Features / Prioritise are later slices.
 */
import React from "react";
import "./youtubeSearchTypeFilters.css";

export type YouTubeSearchTypeFilter =
  | "videos"
  | "shorts"
  | "channel"
  | "playlist"
  | "movie";

const TYPE_OPTIONS: Array<{ id: YouTubeSearchTypeFilter; label: string }> = [
  { id: "videos", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "channel", label: "Channels" },
  { id: "playlist", label: "Playlists" },
  { id: "movie", label: "Movies" },
];

export interface YouTubeSearchTypeFiltersProps {
  selectedType?: YouTubeSearchTypeFilter;
  onTypeChange?: (type: YouTubeSearchTypeFilter) => void;
}

export const YouTubeSearchTypeFilters: React.FC<YouTubeSearchTypeFiltersProps> = ({
  selectedType,
  onTypeChange,
}) => {
  return (
    <div className="yt-search-type-filters" role="group" aria-label="Type">
      <p className="yt-search-type-filters__heading">TYPE</p>
      {TYPE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={
            option.id === selectedType
              ? "yt-search-type-filters__option yt-search-type-filters__option--active"
              : "yt-search-type-filters__option"
          }
          aria-pressed={option.id === selectedType}
          onClick={() => {
            try {
              console.info("[YouTubeSearchTypeFilters] Type selected", {
                searchType: option.id,
              });
              onTypeChange?.(option.id);
            } catch (error) {
              console.error("[YouTubeSearchTypeFilters] Type change failed", {
                searchType: option.id,
              }, error);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
