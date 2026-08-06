import React from "react";
import { EngagementBoosterLaunchButton } from "./EngagementBoosterLaunchButton";

const BANNER_STYLE: React.CSSProperties = {
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

export interface ContentCoachFullRewriteBannerProps {
  draft: string;
  /** Close Content Coach before opening Booster (avoids stacked modals). */
  onBeforeOpen?: () => void;
}

/**
 * Secondary path from Knowledge Center → Content Coach to the full
 * Engagement Booster flow (dimension-level fixes stay in the coach).
 */
export const ContentCoachFullRewriteBanner: React.FC<
  ContentCoachFullRewriteBannerProps
> = ({ draft, onBeforeOpen }) => {
  if (!draft.trim()) return null;

  return (
    <div style={BANNER_STYLE}>
      <p style={COPY_STYLE}>
        <strong>Full engagement rewrite</strong> — rewrite the entire draft for
        hooks, clarity, and engagement with before/after preview scores.
      </p>
      <EngagementBoosterLaunchButton
        content={draft}
        onBeforeOpen={onBeforeOpen}
        disabled={!draft.trim()}
      />
    </div>
  );
};
