import React from "react";
import { useNavigate } from "react-router-dom";
import { YouTubeRailIconButton } from "./YouTubeRailIconButton";

export const YouTubeLibraryButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <YouTubeRailIconButton
      label="Library"
      icon="library"
      dataTour="yt-library"
      onClick={() => navigate("/asset-library?source_module=youtube_creator")}
    />
  );
};
