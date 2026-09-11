import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { resolveOAuthTileClick } from "../studioHubTileActions";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { EngagementWedgeProps } from "./wedgeModalTypes";

export const EngagementWedgeModal: React.FC<EngagementWedgeProps> = ({
  open,
  onClose,
  connected,
  onRequestConnect,
  onOpenComments,
}) => (
  <YouTubeActionModal
    open={open}
    title="Engagement"
    intro={WEDGE_MODAL_INTROS.engagement}
    onClose={onClose}
    maxWidth={1100}
    titleSize="xl"
    headerLayout="centeredRow"
  >
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="💬"
        accent="#0a66c2"
        title="Comment Reply Assistant"
        description="Draft replies in your persona — you send (HITL)."
        hitl
        onClick={() =>
          resolveOAuthTileClick(
            connected,
            "comment_assistant",
            onOpenComments,
            onRequestConnect,
          )
        }
      />
    </div>
  </YouTubeActionModal>
);
