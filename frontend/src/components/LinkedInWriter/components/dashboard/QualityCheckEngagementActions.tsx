import React from "react";
import { EngagementBoosterLaunchButton } from "./EngagementBoosterLaunchButton";

const WRAPPER_STYLE: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  background: "#fffbeb",
  border: "1.5px solid #fcd34d",
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const COPY_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#92400e",
  lineHeight: 1.55,
};

export interface QualityCheckEngagementActionsProps {
  content: string;
  /** When set, shows contextual hint after a low score. */
  overallScore?: number;
}

/**
 * Pre-Publish Quality Check — engagement rewrite entry (primary Publish path).
 */
export const QualityCheckEngagementActions: React.FC<
  QualityCheckEngagementActionsProps
> = ({ content, overallScore }) => {
  if (!content.trim()) return null;

  const showLowScoreHint =
    typeof overallScore === "number" && overallScore < 80;

  return (
    <div
      style={WRAPPER_STYLE}
      data-testid="quality-check-engagement-actions"
    >
      <p style={COPY_STYLE}>
        {showLowScoreHint ? (
          <>
            <strong>Score below 80?</strong> Run a full engagement rewrite
            with before/after preview scores before you publish.
          </>
        ) : (
          <>
            <strong>Optimise for Engagement</strong> — AI rewrite for hooks,
            clarity, and engagement with before/after scores.
          </>
        )}
      </p>
      <EngagementBoosterLaunchButton
        content={content}
        disabled={!content.trim()}
      />
    </div>
  );
};
