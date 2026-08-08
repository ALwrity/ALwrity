/**
 * Content Analytics cross-link — opens Performance Pulse in the Remarket wedge.
 */
import React from "react";
import { openPerformancePulse } from "./workflowWedgeNavigation";

export interface PerformancePulseCrossLinkProps {
  /** Called before navigation (e.g. close parent modal). */
  onBeforeNavigate?: () => void;
}

export const PerformancePulseCrossLink: React.FC<
  PerformancePulseCrossLinkProps
> = ({ onBeforeNavigate }) => {
  const handleClick = () => {
    if (onBeforeNavigate) {
      onBeforeNavigate();
      return;
    }
    openPerformancePulse();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        marginBottom: 16,
        background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
        border: "1px solid #ddd6fe",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#5b21b6",
          lineHeight: 1.45,
          fontWeight: 500,
        }}
      >
        Ready to act on your best (and weakest) posts?
      </span>
      <button
        type="button"
        onClick={handleClick}
        style={{
          flexShrink: 0,
          padding: "6px 12px",
          borderRadius: 8,
          border: "none",
          background: "#7c3aed",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Act on top posts →
      </button>
    </div>
  );
};
