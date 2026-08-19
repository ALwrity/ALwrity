import React from "react";
import "../youtube-plan-wedge.css";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { PlanWedgeProps } from "./wedgeModalTypes";
import { YouTubePlanIdeaWorkspace } from "./YouTubePlanIdeaWorkspace";
import { YouTubePlanSidebarTools } from "./YouTubePlanSidebarTools";

export const PlanWedgeModal: React.FC<PlanWedgeProps> = ({
  open,
  onClose,
  goCreate,
  channelBible = null,
}) => {
  return (
    <YouTubeActionModal
      open={open}
      title="Plan"
      intro={WEDGE_MODAL_INTROS.plan}
      onClose={onClose}
      maxWidth={1100}
    >
      <div className="yt-plan-wedge">
        <div className="yt-plan-wedge-main">
          <YouTubePlanIdeaWorkspace channelBible={channelBible} goCreate={goCreate} />
          <YouTubePlanSidebarTools goCreate={goCreate} />
        </div>
      </div>
    </YouTubeActionModal>
  );
};
