import React from "react";
import { useNavigate } from "react-router-dom";

export const YouTubeLibraryButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="yt-rail-btn"
      data-tour="yt-library"
      onClick={() => navigate("/asset-library?source_module=youtube_creator")}
    >
      Library
    </button>
  );
};
