import React from "react";
import { YouTubeAnalyticsSidebar } from "./YouTubeAnalyticsSidebar";
import { YouTubeKnowledgeCenter } from "./YouTubeKnowledgeCenter";
import { YouTubeLibraryButton } from "./YouTubeLibraryButton";

interface YouTubeRightRailProps {
  connected: boolean;
  channelName?: string | null;
  onConnect: () => void;
  isDesktop: boolean;
  needsAnalyticsReconnect?: boolean;
}

export const YouTubeRightRail: React.FC<YouTubeRightRailProps> = ({
  connected,
  channelName,
  onConnect,
  isDesktop,
  needsAnalyticsReconnect = false,
}) => {
  return (
    <aside
      className="yt-studio-right-rail"
      aria-label="Studio tools"
      style={isDesktop ? undefined : { width: "100%" }}
    >
      <YouTubeAnalyticsSidebar
        connected={connected}
        channelName={channelName}
        onConnect={onConnect}
        needsAnalyticsReconnect={needsAnalyticsReconnect}
      />
      <div className="yt-studio-rail-actions">
        <YouTubeLibraryButton />
        <YouTubeKnowledgeCenter compact={!isDesktop} />
      </div>
    </aside>
  );
};
