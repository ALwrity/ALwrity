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
  if (!isDesktop) {
    return (
      <div className="yt-studio-right-rail" style={{ width: "100%" }}>
        <div className="yt-rail-panel" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <YouTubeLibraryButton />
        </div>
        <YouTubeAnalyticsSidebar
          connected={connected}
          channelName={channelName}
          onConnect={onConnect}
          needsAnalyticsReconnect={needsAnalyticsReconnect}
        />
        <YouTubeKnowledgeCenter compact />
      </div>
    );
  }

  return (
    <aside className="yt-studio-right-rail" aria-label="Studio tools">
      <div className="yt-rail-panel" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <YouTubeLibraryButton />
      </div>
      <YouTubeAnalyticsSidebar
        connected={connected}
        channelName={channelName}
        onConnect={onConnect}
        needsAnalyticsReconnect={needsAnalyticsReconnect}
      />
      <YouTubeKnowledgeCenter />
    </aside>
  );
};
