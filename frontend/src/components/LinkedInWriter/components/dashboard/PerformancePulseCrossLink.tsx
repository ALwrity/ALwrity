/**
 * Content Analytics cross-link — opens Performance Pulse in the Remarket wedge.
 */
import React from "react";
import { openPerformancePulse } from "./workflowWedgeNavigation";

export interface PerformancePulseCrossLinkProps {
  /** Called before navigation (e.g. close parent modal). */
  onBeforeNavigate?: () => void;
  /** When true, fits beside the best-post highlight in one row. */
  inline?: boolean;
}

export const PerformancePulseCrossLink: React.FC<
  PerformancePulseCrossLinkProps
> = ({ onBeforeNavigate, inline = false }) => {
  const handleClick = () => {
    if (onBeforeNavigate) {
      onBeforeNavigate();
      return;
    }
    openPerformancePulse();
  };

  return (
    <div
      className={
        inline
          ? "linkedin-content-analytics-pulse-crosslink linkedin-content-analytics-pulse-crosslink--inline"
          : "linkedin-content-analytics-pulse-crosslink"
      }
    >
      <span className="linkedin-content-analytics-pulse-crosslink__text">
        Ready to act on your best (and weakest) posts?
      </span>
      <button
        type="button"
        onClick={handleClick}
        className="linkedin-content-analytics-pulse-crosslink__btn"
      >
        Act on top posts →
      </button>
    </div>
  );
};
