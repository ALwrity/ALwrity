import React, { useMemo } from "react";

import type { EngagementSummary } from "../../../../services/postAnalyticsApi";
import { colors } from "../GrowthEngine/styles";
import { GROWTH_CONTRIBUTION_TOOLTIP } from "./engagementTrendsCopy";
import { buildOverallGrowthLine } from "./engagementTrendsGrowthLine";

export interface EngagementGrowthDriversPanelProps {
  summary: EngagementSummary;
  showContributionBadges: boolean;
}

/** Left insight box — growth drivers label, badge hint, and overall growth banner. */
export const EngagementGrowthDriversPanel: React.FC<
  EngagementGrowthDriversPanelProps
> = ({ summary, showContributionBadges }) => {
  const overallLine = useMemo(
    () => buildOverallGrowthLine(summary),
    [summary],
  );

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        padding: "8px 10px",
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: overallLine ? 6 : 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#16a34a",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Growth drivers
        </div>
        {showContributionBadges && (
          <div
            title={GROWTH_CONTRIBUTION_TOOLTIP}
            style={{ fontSize: 10, color: colors.textTertiary, cursor: "help" }}
          >
            Badges = share of growth
          </div>
        )}
      </div>

      {overallLine && (
        <div
          style={{
            padding: "8px 10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            color: "#166534",
            lineHeight: 1.4,
          }}
        >
          {overallLine}
        </div>
      )}
    </div>
  );
};
