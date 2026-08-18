import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { NotifyWedgeProps } from "./wedgeModalTypes";

export const PlanWedgeModal: React.FC<NotifyWedgeProps> = ({
  open,
  onClose,
  goCreate,
  markNotify,
  notifyKeys,
  channelBibleNiche,
  onOpenBible,
}) => (
  <YouTubeActionModal open={open} title="Plan" intro={WEDGE_MODAL_INTROS.plan} onClose={onClose}>
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="💡"
        accent="#6366f1"
        title="Topic Discovery"
        description="News, finance, research, and site ideas — pick one, then draft."
        hitl
        onClick={() => goCreate({ step: 0 })}
      />
      <YouTubeToolTile
        icon="📖"
        accent="#0ea5e9"
        title="Channel Bible"
        description={
          channelBibleNiche
            ? `Niche: ${channelBibleNiche} — keep voice & CTA consistent.`
            : "Set niche, audience, CTA, and tone once — apply to every video."
        }
        onClick={onOpenBible}
      />
      <YouTubeToolTile
        icon="🔗"
        accent="#10b981"
        title="Blog / URL → Video"
        description="Highest ROI for SMEs — turn an article into a video plan."
        hitl
        onClick={() => goCreate({ step: 0, focusUrlImport: true })}
      />
      <YouTubeToolTile
        icon="📈"
        accent="#f59e0b"
        title="YouTube Trends"
        description="Native demand signals for your niche."
        comingSoon
        onClick={() => markNotify("yt_trends")}
      />
      <YouTubeToolTile
        icon="🗓️"
        accent="#8b5cf6"
        title="Series Planner"
        description="Sketch 3–5 slots for the week — cadence without a full calendar."
        comingSoon
        onClick={() => markNotify("series_planner")}
      />
      <YouTubeToolTile
        icon="🧠"
        accent="#ec4899"
        title="Brainstorm & Saved Ideas"
        description="Capture HITL-approved ideas for later."
        comingSoon
        onClick={() => markNotify("brainstorm")}
      />
    </div>
    {notifyKeys.yt_trends && <p className="yt-modal-intro">We’ll notify you when Trends ships.</p>}
  </YouTubeActionModal>
);
