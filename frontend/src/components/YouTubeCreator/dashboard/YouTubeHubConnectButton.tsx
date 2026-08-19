import React from "react";
import { YT_RED } from "../constants";

interface YouTubeHubConnectButtonProps {
  connected: boolean;
  onConnect: () => void;
  onCreateVideo: () => void;
}

/** Hub-axis CTA — Connect when disconnected, Create Video when connected. */
export const YouTubeHubConnectButton: React.FC<YouTubeHubConnectButtonProps> = ({
  connected,
  onConnect,
  onCreateVideo,
}) => (
  <button
    type="button"
    className="yt-hub-connect-btn"
    onClick={connected ? onCreateVideo : onConnect}
    style={{
      background: YT_RED,
      color: "white",
      border: "none",
      padding: "10px 22px",
      borderRadius: 50,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 6px 20px rgba(255,0,0,0.35)",
      whiteSpace: "nowrap",
    }}
  >
    {connected ? "Create Video" : "Connect YouTube"}
  </button>
);
