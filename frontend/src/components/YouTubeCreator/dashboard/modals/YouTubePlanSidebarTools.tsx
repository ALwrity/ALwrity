import React from "react";
import { YouTubeToolTile } from "../YouTubeActionModal";
import type { GoCreateFn } from "./wedgeModalTypes";

interface YouTubePlanSidebarToolsProps {
  goCreate: GoCreateFn;
}

/** Right-column planning tools — unlocked shortcuts into Video Creator Plan. */
export const YouTubePlanSidebarTools: React.FC<YouTubePlanSidebarToolsProps> = ({
  goCreate,
}) => (
  <aside className="yt-plan-wedge-sidebar" aria-label="Other planning tools">
    <p className="yt-plan-wedge-sidebar__label">Other Planning Tools</p>
    <div className="yt-plan-wedge-sidebar__stack">
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
    </div>
  </aside>
);
