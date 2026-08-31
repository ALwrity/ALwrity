/**
 * YouTube Studio landing header — mirrors LinkedIn Studio brand block layout.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderControls from "../../shared/HeaderControls";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import { YouTubeSearchBar } from "./YouTubeSearchBar";
import "./youtube-studio-header.css";

type YouTubeSearchHit = {
  video_id: string;
  title: string;
};

export const YouTubeStudioLandingHeader: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<YouTubeSearchHit[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchQueryChange = (nextQuery: string) => {
    try {
      setSearchQuery(nextQuery);
    } catch (error) {
      console.error("[YouTubeStudioLandingHeader] Failed to update search query", error);
    }
  };

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();
    try {
      console.info("[YouTubeStudioLandingHeader] Search submitted", {
        queryLength: query.length,
        hasQuery: query.length > 0,
      });
      if (!query) {
        setSearchHits([]);
        setSearchMessage("Enter a search keyword.");
        return;
      }
      setIsSearching(true);
      setSearchMessage(null);
      setSearchHits([]);
      const data = await youtubeStudioApi.searchByKeyword({
        q: query,
        max_results: 25,
      });
      if (!data?.success) {
        console.warn("[YouTubeStudioLandingHeader] Search returned no results", {
          errorCode: data?.error_code,
        });
        setSearchHits([]);
        setSearchMessage(data?.message || "Search failed.");
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setSearchHits(items);
      setSearchMessage(items.length === 0 ? "No videos found." : null);
      console.info("[YouTubeStudioLandingHeader] Search complete", {
        itemCount: items.length,
      });
    } catch (error) {
      console.error("[YouTubeStudioLandingHeader] Search submit handler failed", error);
      setSearchHits([]);
      setSearchMessage("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <header className="yt-studio-landing-header" aria-label="YouTube Creator Studio">
      <div className="yt-studio-landing-header-row">
        <div className="yt-studio-landing-header-brand">
          <button
            type="button"
            className="yt-studio-landing-header-brand-logo"
            onClick={() => navigate("/dashboard")}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <img src="/alwrity-icon.png" alt="ALwrity" />
          </button>
          <h1 className="yt-studio-landing-header-title">
            <span className="yt-studio-landing-header-brand-line">YouTube</span>
            <span className="yt-studio-landing-header-brand-subline">Creator Studio</span>
          </h1>
        </div>

        <div className="yt-studio-landing-header-right">
          <div className="yt-studio-landing-header-search-slot">
            <YouTubeSearchBar
              value={searchQuery}
              onChange={handleSearchQueryChange}
              onSearch={handleSearchSubmit}
            />
            {isSearching ? (
              <p className="yt-search-results__status" role="status">
                Searching...
              </p>
            ) : null}
            {searchMessage ? (
              <p className="yt-search-results__status" role="status">
                {searchMessage}
              </p>
            ) : null}
            {searchHits.length > 0 ? (
              <ul className="yt-search-results" aria-label="YouTube search results">
                {searchHits.map((hit) => (
                  <li key={hit.video_id} className="yt-search-results__item">
                    <a
                      href={`https://www.youtube.com/watch?v=${hit.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {hit.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <HeaderControls colorMode="light" showAlerts showUser gap={1} />
        </div>
      </div>
    </header>
  );
};
