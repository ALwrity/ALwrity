/**
 * Search filters UPLOAD DATE column — Today, This week, This month, This year.
 * Search.list publishedAfter is computed on the server in the viewer's IANA zone.
 * Do not invent Last hour.
 */
import React from "react";
import "./youtubeSearchUploadDateFilters.css";

export type YouTubeSearchUploadDateFilter = "today" | "week" | "month" | "year";

const UPLOAD_DATE_OPTIONS: Array<{
  id: YouTubeSearchUploadDateFilter;
  label: string;
}> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

export interface YouTubeSearchUploadDateFiltersProps {
  selectedUploadDate?: YouTubeSearchUploadDateFilter;
  onUploadDateChange?: (uploadDate: YouTubeSearchUploadDateFilter) => void;
}

export const YouTubeSearchUploadDateFilters: React.FC<
  YouTubeSearchUploadDateFiltersProps
> = ({ selectedUploadDate, onUploadDateChange }) => {
  return (
    <div className="yt-search-upload-date-filters" role="group" aria-label="Upload date">
      <p className="yt-search-upload-date-filters__heading">UPLOAD DATE</p>
      {UPLOAD_DATE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={
            option.id === selectedUploadDate
              ? "yt-search-upload-date-filters__option yt-search-upload-date-filters__option--active"
              : "yt-search-upload-date-filters__option"
          }
          aria-pressed={option.id === selectedUploadDate}
          onClick={() => {
            try {
              console.info("[YouTubeSearchUploadDateFilters] Upload date selected", {
                uploadDate: option.id,
              });
              onUploadDateChange?.(option.id);
            } catch (error) {
              console.error(
                "[YouTubeSearchUploadDateFilters] Upload date change failed",
                { uploadDate: option.id },
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
