import React from "react";
import {
  YOUTUBE_WORKFLOW_CARDS,
  type YouTubeWorkflowCardId,
} from "./youtubeWorkflowConfig";

interface YouTubeMobileWorkflowGridProps {
  onCardAction: (cardId: YouTubeWorkflowCardId) => void;
}

export const YouTubeMobileWorkflowGrid: React.FC<
  YouTubeMobileWorkflowGridProps
> = ({ onCardAction }) => {
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
      {YOUTUBE_WORKFLOW_CARDS.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onCardAction(card.id)}
          aria-label={`${card.title}: ${card.description}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 4,
            padding: "14px 10px",
            borderRadius: 14,
            border: `1.5px solid ${card.accent}33`,
            background: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
          }}
        >
          <card.icon
            sx={{
              color: card.accent,
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
      ))}
    </div>
  );
};
