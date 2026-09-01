/**
 * Search filters FEATURES column — Live, HD, Subtitles/CC, Creative Commons, 3D.
 * Search.list video filters (requires type=video).
 * Do not invent 4K, 360°, VR180, HDR, Location, or Purchased.
 */
import React from "react";
import "./youtubeSearchFeatureFilters.css";

export type YouTubeSearchFeatureFilter =
  | "live"
  | "hd"
  | "subtitles"
  | "creative_commons"
  | "3d";

const FEATURE_OPTIONS: Array<{ id: YouTubeSearchFeatureFilter; label: string }> = [
  { id: "live", label: "Live" },
  { id: "hd", label: "HD" },
  { id: "subtitles", label: "Subtitles/CC" },
  { id: "creative_commons", label: "Creative Commons" },
  { id: "3d", label: "3D" },
];

export interface YouTubeSearchFeatureFiltersProps {
  selectedFeature?: YouTubeSearchFeatureFilter;
  onFeatureChange?: (feature: YouTubeSearchFeatureFilter) => void;
}

export const YouTubeSearchFeatureFilters: React.FC<
  YouTubeSearchFeatureFiltersProps
> = ({ selectedFeature, onFeatureChange }) => {
  return (
    <div className="yt-search-feature-filters" role="group" aria-label="Features">
      <p className="yt-search-feature-filters__heading">FEATURES</p>
      {FEATURE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={
            option.id === selectedFeature
              ? "yt-search-feature-filters__option yt-search-feature-filters__option--active"
              : "yt-search-feature-filters__option"
          }
          aria-pressed={option.id === selectedFeature}
          onClick={() => {
            try {
              console.info("[YouTubeSearchFeatureFilters] Feature selected", {
                videoFeature: option.id,
              });
              onFeatureChange?.(option.id);
            } catch (error) {
              console.error(
                "[YouTubeSearchFeatureFilters] Feature change failed",
                { videoFeature: option.id },
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
