import React from "react";

import type { EngagementSummary } from "../../../../services/postAnalyticsApi";
import { EngagementGrowthDriversPanel } from "./EngagementGrowthDriversPanel";
import { EngagementTrendsMetadataPanel } from "./EngagementTrendsMetadataPanel";

export interface EngagementTrendsInsightsRowProps {
  summary: EngagementSummary;
  showGrowthDrivers: boolean;
  showContributionBadges: boolean;
  lastSyncedAt?: string | null;
  period?: { from: string; to: string } | null;
  showComparison: boolean;
  onRefresh: () => void;
  loading: boolean;
  syncDisabled?: boolean;
  syncCooldownHint?: string | null;
}

/**
 * Two-box row above the post list (original Growth drivers placement):
 * growth drivers panel (left) + sync metadata panel (right).
 */
export const EngagementTrendsInsightsRow: React.FC<
  EngagementTrendsInsightsRowProps
> = ({
  summary,
  showGrowthDrivers,
  showContributionBadges,
  lastSyncedAt,
  period,
  showComparison,
  onRefresh,
  loading,
  syncDisabled,
  syncCooldownHint,
}) => {
  const hasMetadata = Boolean(lastSyncedAt || (period && showComparison));

  if (!showGrowthDrivers && !hasMetadata) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 8,
        marginBottom: 10,
        flexWrap: "nowrap",
      }}
    >
      {showGrowthDrivers && (
        <EngagementGrowthDriversPanel
          summary={summary}
          showContributionBadges={showContributionBadges}
        />
      )}
      {hasMetadata && (
        <EngagementTrendsMetadataPanel
          lastSyncedAt={lastSyncedAt}
          period={period}
          showComparison={showComparison}
          onRefresh={onRefresh}
          loading={loading}
          syncDisabled={syncDisabled}
          syncCooldownHint={syncCooldownHint}
        />
      )}
    </div>
  );
};
