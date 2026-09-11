import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { resolveOAuthTileClick } from "../studioHubTileActions";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { AnalysisWedgeProps } from "./wedgeModalTypes";

export const AnalysisWedgeModal: React.FC<AnalysisWedgeProps> = ({
  open,
  onClose,
  connected,
  onRequestConnect,
  onOpenPulse,
  onOpenVideoPerformance,
  onOpenVideoAnalytics,
}) => (
  <YouTubeActionModal
    open={open}
    title="Analysis"
    intro={WEDGE_MODAL_INTROS.analysis}
    onClose={onClose}
    maxWidth={1100}
    titleSize="xl"
    headerLayout="centeredRow"
  >
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="📊"
        accent="#8b5cf6"
        title="Channel Pulse"
        description="Lifetime subscribers and views, plus 28-day watch time."
        onClick={() =>
          resolveOAuthTileClick(connected, "channel_pulse", onOpenPulse, onRequestConnect)
        }
      />
      <YouTubeToolTile
        icon="📈"
        accent="#0ea5e9"
        title="Video Performance"
        description="Recent uploads with public views, likes, and comments."
        onClick={() =>
          resolveOAuthTileClick(
            connected,
            "video_performance",
            onOpenVideoPerformance,
            onRequestConnect,
          )
        }
      />
      <YouTubeToolTile
        icon="📉"
        accent="#ff0000"
        title="Video Analytics"
        description="Overview, Audience, Content, and Trends for your videos."
        onClick={() =>
          resolveOAuthTileClick(
            connected,
            "video_analytics",
            onOpenVideoAnalytics,
            onRequestConnect,
          )
        }
      />
    </div>
  </YouTubeActionModal>
);
