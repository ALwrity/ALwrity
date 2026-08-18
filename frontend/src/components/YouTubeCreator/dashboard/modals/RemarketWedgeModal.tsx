import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { resolveOAuthTileClick } from "../studioHubTileActions";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { RemarketWedgeProps } from "./wedgeModalTypes";

export const RemarketWedgeModal: React.FC<RemarketWedgeProps> = ({
  open,
  onClose,
  goCreate,
  connected,
  onRequestConnect,
  creatorState,
  onOpenStale,
  onNavigateBlog,
  onNavigateLibrary,
}) => {
  const outline = creatorState.videoPlan?.content_outline || [];
  const last = outline[outline.length - 1] as unknown;
  const lastLabel =
    typeof last === "string"
      ? last
      : last && typeof last === "object"
        ? String(
            (last as { section?: string; description?: string }).section ||
              (last as { description?: string }).description ||
              "",
          )
        : "";
  const nextIdea = lastLabel
    ? `Episode next: continue from “${lastLabel}”`
    : creatorState.userIdea || "Next episode in my series";

  return (
    <YouTubeActionModal
      open={open}
      title="Remarket"
      intro={WEDGE_MODAL_INTROS.remarket}
      onClose={onClose}
    >
      <div className="yt-tool-tile-grid">
        <YouTubeToolTile
          icon="✂️"
          accent="#ff0000"
          title="Winner → Shorts"
          description="Cheap reach — prefill shorts from your current idea/script."
          hitl
          onClick={() =>
            goCreate({
              step: 0,
              durationType: "shorts",
              userIdea: creatorState.userIdea || creatorState.videoPlan?.video_summary || "",
            })
          }
        />
        <YouTubeToolTile
          icon="🔄"
          accent="#8b5cf6"
          title="Perf → Plan"
          description="Close the loop — start a new plan from your last video."
          hitl
          onClick={() =>
            goCreate({
              step: 0,
              userIdea:
                creatorState.videoPlan?.selected_title ||
                creatorState.userIdea ||
                "Sequel based on my last video",
            })
          }
        />
        <YouTubeToolTile
          icon="🌉"
          accent="#0ea5e9"
          title="Blog ↔ Video Bridge"
          description="Cross-studio flywheel — import URL or open Blog Writer."
          onClick={onNavigateBlog}
        />
        <YouTubeToolTile
          icon="🌱"
          accent="#dc2626"
          title="Stale Video Refresh"
          description="New title/thumb/desc for buried winners — HITL apply."
          hitl
          onClick={() =>
            resolveOAuthTileClick(connected, "stale_refresh", onOpenStale, onRequestConnect)
          }
        />
        <YouTubeToolTile
          icon="📺"
          accent="#059669"
          title="Series Continuation"
          description="Episode N+1 from your last plan outline."
          hitl
          onClick={() => goCreate({ step: 0, userIdea: nextIdea })}
        />
        <YouTubeToolTile
          icon="♻️"
          accent="#f59e0b"
          title="Repurpose Lab"
          description="Turn scripts into LinkedIn/blog assets."
          onClick={onNavigateLibrary}
        />
      </div>
    </YouTubeActionModal>
  );
};
