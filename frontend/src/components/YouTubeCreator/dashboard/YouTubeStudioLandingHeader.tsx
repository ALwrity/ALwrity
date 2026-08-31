/**
 * YouTube Studio landing header — mirrors LinkedIn Studio brand block layout.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderControls from "../../shared/HeaderControls";
import { YouTubeSearchBar } from "./YouTubeSearchBar";
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

  const handleSearchSubmit = () => {
    try {
      console.info("[YouTubeStudioLandingHeader] Search submit ignored — results not implemented", {
        queryLength: searchQuery.trim().length,
      });
    } catch (error) {
      console.error("[YouTubeStudioLandingHeader] Search submit handler failed", error);
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
