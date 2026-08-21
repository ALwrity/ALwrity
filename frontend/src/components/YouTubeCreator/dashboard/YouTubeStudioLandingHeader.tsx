/**
 * YouTube Studio landing header — mirrors LinkedIn Studio brand block layout.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import HeaderControls from "../../shared/HeaderControls";
import "./youtube-studio-header.css";

export const YouTubeStudioLandingHeader: React.FC = () => {
  const navigate = useNavigate();

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
          <HeaderControls colorMode="light" showAlerts showUser gap={1} />
        </div>
      </div>
    </header>
  );
};
