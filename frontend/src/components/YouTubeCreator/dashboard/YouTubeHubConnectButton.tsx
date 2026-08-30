import React from "react";
import { YouTubeHubConnectAnchor } from "./YouTubeHubConnectAnchor";
import {
  YOUTUBE_CONNECT_CTA,
  YOUTUBE_DISCONNECT_CTA,
  YOUTUBE_DISCONNECTING_CTA,
  YOUTUBE_HUB_CONNECT_BUTTON_STYLE,
} from "./youtubeHubConnectUi";

interface YouTubeHubConnectButtonProps {
  connected: boolean;
  onConnect: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}

/** Hub-axis CTA — Connect when disconnected, Disconnect when connected (LinkedIn parity). */
export const YouTubeHubConnectButton: React.FC<YouTubeHubConnectButtonProps> = ({
  connected,
  onConnect,
  onDisconnect,
  isLoading = false,
  isConnecting = false,
  isDisconnecting = false,
}) => {
  const busy = isLoading || isConnecting || isDisconnecting;
  const label = isDisconnecting
    ? YOUTUBE_DISCONNECTING_CTA
    : busy
      ? "Checking connection..."
      : connected
        ? YOUTUBE_DISCONNECT_CTA
        : YOUTUBE_CONNECT_CTA;

  return (
    <YouTubeHubConnectAnchor>
      <button
        type="button"
        className="yt-hub-connect-btn"
        onClick={() => {
          if (connected) {
            onDisconnect?.();
            return;
          }
          onConnect();
        }}
        disabled={busy || (connected && !onDisconnect)}
        aria-busy={busy || undefined}
        aria-label={label}
        style={{
          ...YOUTUBE_HUB_CONNECT_BUTTON_STYLE,
          opacity: busy ? 0.82 : 1,
          cursor: busy || (connected && !onDisconnect) ? "default" : "pointer",
        }}
      >
        {label}
      </button>
    </YouTubeHubConnectAnchor>
  );
};
