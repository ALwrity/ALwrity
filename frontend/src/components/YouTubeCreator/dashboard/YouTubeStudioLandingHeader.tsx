/**
 * YouTube Studio landing header — mirrors LinkedIn Studio brand block layout.
 * Keyword Search.list results open on the Hub panel, not this header slot.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderControls from "../../shared/HeaderControls";
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import { YouTubeSearchBar } from "./YouTubeSearchBar";
import { publishYouTubeSearchResults } from "./youtubeStudioEvents";
import "./youtube-studio-header.css";

export const YouTubeStudioLandingHeader: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

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
        publishYouTubeSearchResults({
          query: "",
          items: [],
          message: "Enter a search keyword.",
        });
        return;
      }
      publishYouTubeSearchResults({
        query,
        items: [],
        message: "Searching...",
      });
      const data = await youtubeStudioApi.searchByKeyword({
        q: query,
        max_results: 25,
      });
      if (!data?.success) {
        console.warn("[YouTubeStudioLandingHeader] Search returned no results", {
          errorCode: data?.error_code,
        });
        publishYouTubeSearchResults({
          query,
          items: [],
          message: data?.message || "Search failed.",
        });
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      publishYouTubeSearchResults({
        query,
        items,
        message: items.length === 0 ? "No videos found." : null,
      });
      console.info("[YouTubeStudioLandingHeader] Search complete", {
        itemCount: items.length,
      });
    } catch (error) {
      console.error("[YouTubeStudioLandingHeader] Search submit handler failed", error);
      publishYouTubeSearchResults({
        query,
        items: [],
        message: "Search failed.",
      });
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
          </div>
          <HeaderControls colorMode="light" showAlerts showUser gap={1} />
        </div>
      </div>
    </header>
  );
};
