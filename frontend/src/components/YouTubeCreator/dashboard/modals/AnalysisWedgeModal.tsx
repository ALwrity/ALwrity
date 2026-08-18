import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
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
  >
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="📊"
        accent="#8b5cf6"
        title="Channel Pulse"
        description={
          connected
            ? "Subscribers, views, and 28-day watch metrics."
            : "Connect YouTube to unlock channel pulse."
        }
        onClick={() => (connected ? onOpenPulse() : onRequestConnect())}
      />
      <YouTubeToolTile
        icon="📈"
        accent="#0ea5e9"
        title="Video Performance"
        description="Recent uploads with view/like signals from your channel."
        onClick={() => (connected ? onOpenStale() : onRequestConnect())}
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
        onClick={() => (connected ? onOpenRetention() : onRequestConnect())}
      />
    </div>
  </YouTubeActionModal>
);
