import React from "react";
import { YOUTUBE_HUB_CONNECT_ANCHOR_MAX_WIDTH_PX } from "./youtubeHubConnectUi";

interface YouTubeHubConnectAnchorProps {
  children: React.ReactNode;
}

/** Centers the hub-axis CTA on the shared radial / profile hub column. */
export const YouTubeHubConnectAnchor: React.FC<YouTubeHubConnectAnchorProps> = ({
  children,
}) => (
  <div
    className="yt-hub-connect-anchor"
    data-tour="yt-connect-action"
    style={{
      display: "inline-flex",
      width: "100%",
      maxWidth: YOUTUBE_HUB_CONNECT_ANCHOR_MAX_WIDTH_PX,
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);
