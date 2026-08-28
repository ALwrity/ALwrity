import React from "react";
import { YouTubeHubConnectAnchor } from "./YouTubeHubConnectAnchor";
import {
  YOUTUBE_CONNECT_CTA,
  YOUTUBE_CREATE_VIDEO_CTA,
  YOUTUBE_HUB_CONNECT_BUTTON_STYLE,
} from "./youtubeHubConnectUi";

interface YouTubeHubConnectButtonProps {
  connected: boolean;
  onConnect: () => void;
  onCreateVideo: () => void;
  isLoading?: boolean;
  isConnecting?: boolean;
}

/** Hub-axis CTA — Connect when disconnected, Create Video when connected (LinkedIn-sized). */
export const YouTubeHubConnectButton: React.FC<YouTubeHubConnectButtonProps> = ({
  connected,
  onConnect,
  onCreateVideo,
  isLoading = false,
  isConnecting = false,
}) => {
  const busy = isLoading || isConnecting;
  const label = busy
    ? "Checking connection..."
    : connected
      ? YOUTUBE_CREATE_VIDEO_CTA
      : YOUTUBE_CONNECT_CTA;

  return (
    <YouTubeHubConnectAnchor>
      <button
        type="button"
        className="yt-hub-connect-btn"
        onClick={connected ? onCreateVideo : onConnect}
        disabled={busy}
        aria-busy={busy || undefined}
        style={{
          ...YOUTUBE_HUB_CONNECT_BUTTON_STYLE,
          opacity: busy ? 0.82 : 1,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {label}
      </button>
    </YouTubeHubConnectAnchor>
  );
};
