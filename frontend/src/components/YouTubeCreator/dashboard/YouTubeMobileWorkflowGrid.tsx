import React from "react";
import { isWedgeConnectGated } from "./studioHubAccessConfig";
import {
  YOUTUBE_WORKFLOW_CARDS,
  type YouTubeWorkflowCardId,
} from "./youtubeWorkflowConfig";

interface YouTubeMobileWorkflowGridProps {
  onCardAction: (cardId: YouTubeWorkflowCardId) => void;
  connected?: boolean;
}

export const YouTubeMobileWorkflowGrid: React.FC<
  YouTubeMobileWorkflowGridProps
> = ({ onCardAction, connected = true }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
        width: "100%",
        padding: "0 4px",
        boxSizing: "border-box",
      }}
    >
      {YOUTUBE_WORKFLOW_CARDS.map((card) => {
        const isConnectLocked = isWedgeConnectGated(card.id, connected);
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onCardAction(card.id)}
            aria-label={`${card.title}: ${card.description}`}
            title={
              isConnectLocked
                ? `Connect YouTube to unlock ${card.title}`
                : undefined
            }
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 4,
              padding: "14px 10px",
              borderRadius: 14,
              border: `1.5px solid ${
                isConnectLocked ? "rgba(148,163,184,0.5)" : `${card.accent}33`
              }`,
              background: isConnectLocked ? "rgba(226,232,240,0.6)" : "#ffffff",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
            }}
          >
            <card.icon
              sx={{
                color: isConnectLocked ? "#94a3b8" : card.accent,
                fontSize: 26,
              }}
              aria-hidden
            />
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f0f0f" }}>
              {card.title}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#606060",
                lineHeight: 1.3,
              }}
            >
              {card.description}
            </div>
          </button>
        );
      })}
    </div>
  );
};
