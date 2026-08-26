import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { resolveOAuthTileClick } from "../studioHubTileActions";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { PublishWedgeProps } from "./wedgeModalTypes";

export const PublishWedgeModal: React.FC<PublishWedgeProps> = ({
  open,
  onClose,
  goCreate,
  connected,
  onRequestConnect,
  creatorState,
  onOpenDrafts,
  onOpenCoach,
  onOpenCost,
  onOpenSchedule,
  onOpenPlaylist,
}) => (
  <YouTubeActionModal
    open={open}
    title="Publish"
    intro={WEDGE_MODAL_INTROS.publish}
    onClose={onClose}
    maxWidth={1100}
    titleSize="xl"
    headerLayout="centeredRow"
  >
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="📁"
        accent="#0a66c2"
        title="My Drafts / In Progress"
        description="Resume unfinished videos or open rendered files."
        onClick={() => {
          if (creatorState.videoPlan || creatorState.userIdea) {
            goCreate({ step: creatorState.activeStep || 0 });
          } else {
            onOpenDrafts();
          }
        }}
      />
      <YouTubeToolTile
        icon="🚀"
        accent="#ff0000"
        title="Publish to YouTube"
        description="Connect & upload with title, description, and privacy."
        hitl
        onClick={() =>
          resolveOAuthTileClick(
            connected,
            "publish_to_youtube",
            () => goCreate({ step: 3 }),
            onRequestConnect,
          )
        }
      />
      <YouTubeToolTile
        icon="🎯"
        accent="#8b5cf6"
        title="Pre-Publish Coach"
        description="Score title, hook, CTA, and keywords before you ship."
        hitl
        onClick={onOpenCoach}
      />
      <YouTubeToolTile
        icon="💰"
        accent="#059669"
        title="Cost Preflight"
        description="Estimate render spend before you start the queue."
        onClick={onOpenCost}
      />
      <YouTubeToolTile
        icon="⏰"
        accent="#0ea5e9"
        title="Schedule Publish"
        description="Peak-time publish — private until go-live on YouTube."
        hitl
        onClick={() =>
          resolveOAuthTileClick(connected, "schedule_publish", onOpenSchedule, onRequestConnect)
        }
      />
      <YouTubeToolTile
        icon="📚"
        accent="#64748b"
        title="Playlist / Series Attach"
        description="Package published videos into playlists for retention."
        onClick={() =>
          resolveOAuthTileClick(connected, "playlist_attach", onOpenPlaylist, onRequestConnect)
        }
      />
    </div>
  </YouTubeActionModal>
);
