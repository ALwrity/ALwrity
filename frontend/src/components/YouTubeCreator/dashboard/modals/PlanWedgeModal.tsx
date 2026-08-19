import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { PlanWedgeProps } from "./wedgeModalTypes";

export const PlanWedgeModal: React.FC<PlanWedgeProps> = ({
  open,
  onClose,
  goCreate,
  channelBibleNiche,
  onOpenBible,
}) => (
  <YouTubeActionModal open={open} title="Plan" intro={WEDGE_MODAL_INTROS.plan} onClose={onClose}>
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="💡"
        accent="#6366f1"
        title="Topic Discovery"
        description="Brainstorm ideas, browse trends, and save picks for your next video."
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
        onClick={() => goCreate({ step: 0 })}
      />
      <YouTubeToolTile
        icon="🗓️"
        accent="#8b5cf6"
        title="Series Planner"
        description="Sketch 3–5 slots for the week — cadence without a full calendar."
        onClick={() => goCreate({ step: 0 })}
      />
      <YouTubeToolTile
        icon="🧠"
        accent="#ec4899"
        title="Brainstorm & Saved Ideas"
        description="Capture HITL-approved ideas for later."
        onClick={() => goCreate({ step: 0 })}
      />
    </div>
  </YouTubeActionModal>
);
