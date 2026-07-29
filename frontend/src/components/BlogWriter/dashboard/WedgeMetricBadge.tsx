import React from "react";
import type { BlogWorkflowCardId } from "./blogWorkflowConfig";

/**
 * Live, data-backed metric text shown on each wedge — sourced from
 * `GET /api/blog/analytics/summary` (see `useBlogWorkflowMetrics`).
 * Keeping this a simple string keeps the wedge/grid renderers presentational.
 */
export type BlogWedgeMetrics = Partial<Record<BlogWorkflowCardId, string>>;

interface WedgeMetricBadgeProps {
  label: string;
  accent: string;
  compact?: boolean;
}

/** Small pill used inside a wedge/mobile card to surface one daily-value metric. */
export const WedgeMetricBadge: React.FC<WedgeMetricBadgeProps> = ({
  label,
  accent,
  compact = false,
}) => (
  <div
    style={{
      marginTop: compact ? 2 : 4,
      fontSize: compact ? 9 : 10,
      fontWeight: 700,
      color: accent,
      background: `${accent}1A`,
      borderRadius: 999,
      padding: compact ? "1px 7px" : "2px 9px",
      lineHeight: 1.4,
      maxWidth: "100%",
      overflowWrap: "break-word",
      wordBreak: "break-word",
      textAlign: "center",
    }}
  >
    {label}
  </div>
);
