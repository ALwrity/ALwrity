import React, { useId } from "react";

interface PlanStartHereBadgeProps {
  accent: string;
  className?: string;
}

/** Bookmark ribbon with V-notch (viewBox 0 0 40 44). Desktop radial hero only (≥601px). */
const BOOKMARK_PATH = "M4 2 H36 V40 L20 31 L4 40 Z";

/**
 * Mint bookmark START HERE badge — wide-screen Plan wedge only.
 */
export const PlanStartHereBadge: React.FC<PlanStartHereBadgeProps> = ({
  accent: _accent,
  className,
}) => {
  const gradientId = useId().replace(/:/g, "");

  return (
    <span
      className={["workflow-wedge-bookmark-badge", className].filter(Boolean).join(" ")}
      style={{ ["--bookmark-ribbon-color" as string]: "#b9faf8" }}
      aria-hidden
    >
      <svg
        className="workflow-wedge-bookmark-badge__svg"
        viewBox="0 0 40 44"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dcfefe" />
            <stop offset="45%" stopColor="#b9faf8" />
            <stop offset="100%" stopColor="#8ee8e4" />
          </linearGradient>
        </defs>
        <path
          className="workflow-wedge-bookmark-badge__path"
          d={BOOKMARK_PATH}
          fill={`url(#${gradientId})`}
        />
      </svg>
      <span className="workflow-wedge-bookmark-badge__text">
        <span className="workflow-wedge-bookmark-badge__line">START</span>
        <span className="workflow-wedge-bookmark-badge__line workflow-wedge-bookmark-badge__line--bold">
          HERE
        </span>
      </span>
    </span>
  );
};
