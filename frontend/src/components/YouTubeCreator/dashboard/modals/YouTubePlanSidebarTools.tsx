import React from "react";
import { YouTubeToolTile } from "../YouTubeActionModal";
import type { GoCreateFn } from "./wedgeModalTypes";

interface YouTubePlanSidebarToolsProps {
  goCreate: GoCreateFn;
  onOpenUrlImport: () => void;
  onOpenCommunity: () => void;
}

/** Right-column planning tools — Blog/URL, cadence, and community posts. */
export const YouTubePlanSidebarTools: React.FC<YouTubePlanSidebarToolsProps> = ({
  goCreate,
  onOpenUrlImport,
  onOpenCommunity,
}) => (
  <aside className="yt-plan-wedge-sidebar" aria-label="Other planning tools">
    <p className="yt-plan-wedge-sidebar__label">Other Planning Tools</p>
    <div className="yt-plan-wedge-sidebar__stack">
      <YouTubeToolTile
        icon="🔗"
        accent="#0d9488"
        title="Blog / URL → Video"
        description="Highest ROI for SMEs — turn an article into a video plan."
        hitl
        onClick={onOpenUrlImport}
      />
      <YouTubeToolTile
        icon="📈"
        accent="#f59e0b"
        title="YouTube Trends"
        description="Native demand signals for your niche."
        hitl
        onClick={() => goCreate({ step: 0 })}
      />
      <YouTubeToolTile
        icon="🗓️"
        accent="#8b5cf6"
        title="Series Planner"
        description="Sketch 3–5 slots for the week — cadence without a full calendar."
        hitl
        onClick={() => goCreate({ step: 0 })}
      />
      <YouTubeToolTile
        icon="🗣️"
        accent="#10b981"
        title="Community Post Ideas"
        description="Between-video touchpoints — copy into YouTube Studio."
        hitl
        onClick={() => {
          console.info("[YouTubePlan] Open Community Post Ideas");
          onOpenCommunity();
        }}
      />
    </div>
  </aside>
);
