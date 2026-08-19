import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { resolveOAuthTileClick } from "../studioHubTileActions";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { EngagementWedgeProps } from "./wedgeModalTypes";

export const EngagementWedgeModal: React.FC<EngagementWedgeProps> = ({
  open,
  onClose,
  goCreate,
  connected,
  onRequestConnect,
  creatorState,
  onOpenComments,
  onOpenCommunity,
}) => (
  <YouTubeActionModal
    open={open}
    title="Engagement"
    intro={WEDGE_MODAL_INTROS.engagement}
    onClose={onClose}
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
      <YouTubeToolTile
        icon="📌"
        accent="#ff0000"
        title="Pin / Top Comment Pack"
        description="Generate a pin comment CTA from your plan."
        hitl
        onClick={() => {
          const cta =
            creatorState.videoPlan?.call_to_action ||
            "Thanks for watching — comment your biggest takeaway!";
          void navigator.clipboard?.writeText(cta);
          goCreate({ step: creatorState.videoPlan ? 1 : 0 });
        }}
      />
      <YouTubeToolTile
        icon="🗣️"
        accent="#10b981"
        title="Community Post Ideas"
        description="Between-video touchpoints — copy into YouTube Studio."
        hitl
        onClick={onOpenCommunity}
      />
      <YouTubeToolTile
        icon="⏱️"
        accent="#f59e0b"
        title="Engage Queue"
        description="Open comment inbox for your daily reply routine."
        hitl
        onClick={() =>
          resolveOAuthTileClick(connected, "engage_queue", onOpenComments, onRequestConnect)
        }
      />
    </div>
  </YouTubeActionModal>
);
