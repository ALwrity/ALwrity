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
  onOpenStale,
  onOpenSeo,
  onOpenGaps,
  onOpenRetention,
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
        description="Subscribers, views, and 28-day watch metrics."
        onClick={() =>
          resolveOAuthTileClick(connected, "channel_pulse", onOpenPulse, onRequestConnect)
        }
      />
      <YouTubeToolTile
        icon="📈"
        accent="#0ea5e9"
        title="Video Performance"
        description="Recent uploads with view/like signals from your channel."
        onClick={() =>
          resolveOAuthTileClick(connected, "video_performance", onOpenStale, onRequestConnect)
        }
      />
      <YouTubeToolTile
        icon="🔎"
        accent="#6366f1"
        title="SEO & Metadata Audit"
        description="Audit title/desc/tags vs your plan keywords."
        hitl
        onClick={onOpenSeo}
      />
      <YouTubeToolTile
        icon="🧩"
        accent="#10b981"
        title="Content Gaps"
        description="Fill niche holes from your Channel Bible + recent uploads."
        hitl
        onClick={onOpenGaps}
      />
      <YouTubeToolTile
        icon="⏱️"
        accent="#f59e0b"
        title="Audience / Retention"
        description="Avg view duration and watch-time tips."
        onClick={() =>
          resolveOAuthTileClick(connected, "retention", onOpenRetention, onRequestConnect)
        }
      />
    </div>
  </YouTubeActionModal>
);
