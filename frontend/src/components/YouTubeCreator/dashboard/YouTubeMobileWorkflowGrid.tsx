import React, { useState } from "react";
import { isWedgeConnectGated } from "./studioHubAccessConfig";
import {
  PLAN_PINNED_HINT_KEY,
  RECOMMENDED_WORKFLOW_CARD_ID,
  YOUTUBE_WORKFLOW_CARDS,
  type YouTubeWorkflowCardId,
} from "./youtubeWorkflowConfig";
import { isYouTubePlanWedge } from "./youtubePlanWedgeUi";
import { ConnectLockBadge } from "../../LinkedInWriter/components/dashboard/ConnectLockIcon";

interface YouTubeMobileWorkflowGridProps {
  onCardAction: (cardId: YouTubeWorkflowCardId) => void;
  profileHubSlot?: React.ReactNode;
  studioActionsSlot?: React.ReactNode;
  connected?: boolean;
}

export const YouTubeMobileWorkflowGrid: React.FC<
  YouTubeMobileWorkflowGridProps
> = ({
  onCardAction,
  profileHubSlot,
  studioActionsSlot,
  connected = true,
}) => {
  const [showPlanHint, setShowPlanHint] = useState(
    () => !sessionStorage.getItem(PLAN_PINNED_HINT_KEY),
  );

  const handleCardAction = (cardId: YouTubeWorkflowCardId) => {
    if (cardId === RECOMMENDED_WORKFLOW_CARD_ID && showPlanHint) {
      sessionStorage.setItem(PLAN_PINNED_HINT_KEY, "1");
      setShowPlanHint(false);
    }
    onCardAction(cardId);
  };

  return (
    <section
      className="yt-dashboard-mobile-workflow"
      aria-label="Studio actions"
      data-tour="yt-mobile-workflow"
    >
      {studioActionsSlot}

      <div className="yt-dashboard-mobile-workflow-header">
        <h2
          className="yt-dashboard-mobile-workflow-title yt-dashboard-mobile-workflow-title--stacked"
          aria-label="What are You Creating Today"
        >
          <span>What are You</span>
          <span>
            Creating Today{" "}
            <span className="yt-dashboard-mobile-workflow-title-emoji" aria-hidden>
              🎯
            </span>
          </span>
        </h2>
        {profileHubSlot}
      </div>

      <div className="yt-dashboard-mobile-workflow-grid">
        {YOUTUBE_WORKFLOW_CARDS.map((card) => {
          const isPlanWedge = isYouTubePlanWedge(card.id);
          const isRecommended = isPlanWedge && showPlanHint;
          const isConnectLocked = isWedgeConnectGated(card.id, connected);
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              type="button"
              className={[
                "yt-dashboard-mobile-workflow-card",
                isRecommended && "yt-dashboard-mobile-workflow-card--recommended",
                isConnectLocked && "yt-studio-connect-locked",
              ]
                .filter(Boolean)
                .join(" ")}
              data-tour={`yt-wedge-${card.id}`}
              onClick={() => handleCardAction(card.id)}
              aria-label={`${card.title}: ${card.description}`}
              title={
                isConnectLocked
                  ? `Connect YouTube to unlock ${card.title}`
                  : undefined
              }
              style={
                {
                  "--workflow-card-accent": card.accent,
                } as React.CSSProperties
              }
            >
              {isPlanWedge && (
                <span className="yt-dashboard-mobile-workflow-badge">
                  <span>START</span>
                  <span>HERE</span>
                </span>
              )}
              <span className="yt-dashboard-mobile-workflow-card-head">
                <span
                  className="yt-dashboard-mobile-workflow-icon"
                  style={{ color: isConnectLocked ? "#94a3b8" : card.accent }}
                  aria-hidden
                >
                  <Icon fontSize="inherit" />
                </span>
                <span className="yt-dashboard-mobile-workflow-label">
                  {card.title}
                </span>
                {isConnectLocked && <ConnectLockBadge size={11} />}
              </span>
              <span className="yt-dashboard-mobile-workflow-desc">
                {card.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
