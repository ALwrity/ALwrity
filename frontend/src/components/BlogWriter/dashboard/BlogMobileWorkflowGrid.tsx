import React from "react";
import {
  BLOG_WORKFLOW_CARDS,
  CONNECT_GATED_WORKFLOW_IDS,
  type BlogWorkflowCardId,
} from "./blogWorkflowConfig";
import { WedgeMetricBadge, type BlogWedgeMetrics } from "./WedgeMetricBadge";

interface BlogMobileWorkflowGridProps {
  onCardAction: (cardId: BlogWorkflowCardId) => void;
  connected?: boolean;
  metrics?: BlogWedgeMetrics;
}

/** Flat 6-card fallback for narrow viewports (mirrors the desktop radial ring's content). */
export const BlogMobileWorkflowGrid: React.FC<BlogMobileWorkflowGridProps> = ({
  onCardAction,
  connected = true,
  metrics = {},
}) => {
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
      {BLOG_WORKFLOW_CARDS.map((card) => {
        const isConnectLocked = !connected && CONNECT_GATED_WORKFLOW_IDS.includes(card.id);
        const metricLabel = metrics[card.id];
        return (
          <button
            key={card.id}
            onClick={() => onCardAction(card.id)}
            aria-label={`${card.title}: ${card.description}`}
            title={isConnectLocked ? `Connect WordPress or Wix to unlock ${card.title}` : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 4,
              padding: "14px 10px",
              borderRadius: 14,
              border: `1.5px solid ${isConnectLocked ? "rgba(148,163,184,0.5)" : `${card.accent}33`}`,
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
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
              {card.title}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#64748b", lineHeight: 1.3 }}>
              {card.description}
            </div>
            {metricLabel && (
              <WedgeMetricBadge label={metricLabel} accent={card.accent} compact />
            )}
          </button>
        );
      })}
    </div>
  );
};
