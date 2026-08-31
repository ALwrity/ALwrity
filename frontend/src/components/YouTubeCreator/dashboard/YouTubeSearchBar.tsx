import React, { useId } from "react";
import "./youtubeSearchBar.css";

interface YouTubeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

const SearchIcon: React.FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function applyQueryChange(onChange: (value: string) => void, nextValue: string): void {
  try {
    onChange(nextValue);
  } catch (error) {
    console.error("[YouTubeSearchBar] Failed to update query", error);
  }
}

function submitSearch(onSearch: () => void, query: string): void {
  try {
    const queryLength = query.trim().length;
    console.info("[YouTubeSearchBar] Search submitted", {
      queryLength,
      hasQuery: queryLength > 0,
    });
    onSearch();
  } catch (error) {
    console.error("[YouTubeSearchBar] Failed to submit search", error);
  }
}

/** Hub header search field — submit is handled by the parent (Search.list). */
export const YouTubeSearchBar: React.FC<YouTubeSearchBarProps> = ({
  value,
  onChange,
  onSearch,
}) => {
  const inputId = useId();

  return (
    <div className="yt-search-bar-wrap">
      <div className="yt-search-bar yt-search-bar--nav">
        <span className="yt-search-bar__icon" aria-hidden>
          <SearchIcon />
        </span>
        <input
          id={inputId}
          type="search"
          className="yt-search-bar__input"
          value={value}
          onChange={(event) => applyQueryChange(onChange, event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            submitSearch(onSearch, value);
          }}
          placeholder="Search"
          aria-label="Search YouTube"
        />
      </div>
    </div>
  );
};
