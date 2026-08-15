import React, { useMemo } from "react";

import { colors } from "../GrowthEngine/styles";
import {
  formatLocalizedComparisonPeriod,
  formatLocalizedRelativeTime,
} from "./engagementTrendsLocaleFormat";
import { EMPTY_COPY } from "./engagementTrendsCopy";

export interface EngagementTrendsMetadataPanelProps {
  lastSyncedAt?: string | null;
  period?: { from: string; to: string } | null;
  showComparison: boolean;
  onRefresh: () => void;
  loading: boolean;
  syncDisabled?: boolean;
  syncCooldownHint?: string | null;
}

/** Right insight box — last updated, comparison window, and Sync Latest. */
export const EngagementTrendsMetadataPanel: React.FC<
  EngagementTrendsMetadataPanelProps
> = ({
  lastSyncedAt,
  period,
  showComparison,
  onRefresh,
  loading,
  syncDisabled = false,
  syncCooldownHint = null,
}) => {
  const comparison = useMemo(
    () =>
      period && showComparison
        ? formatLocalizedComparisonPeriod(period.from, period.to)
        : null,
    [period, showComparison],
  );

  if (!lastSyncedAt && !comparison) {
    return null;
  }

  const refreshDisabled = loading || syncDisabled;

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        padding: "8px 10px",
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 11,
        color: colors.textSecondary,
        lineHeight: 1.45,
      }}
    >
      {lastSyncedAt && (
        <div style={{ marginBottom: comparison || syncCooldownHint ? 6 : 0 }}>
          <span style={{ fontWeight: 700, color: colors.textTertiary }}>
            Last updated:{" "}
          </span>
          <span style={{ color: colors.textDark, fontWeight: 600 }}>
            {formatLocalizedRelativeTime(lastSyncedAt)}
          </span>
        </div>
      )}
      {syncCooldownHint && (
        <div style={{ marginBottom: 6, fontSize: 10, color: "#b45309" }}>
          {EMPTY_COPY.syncCooldownPrefix} ({syncCooldownHint}).
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "nowrap",
        }}
      >
        {comparison ? (
          <div
            style={{ minWidth: 0, flex: "1 1 auto" }}
            title={`${comparison.previous.display} → ${comparison.latest.display}`}
          >
            <span style={{ fontWeight: 700, color: colors.textTertiary }}>
              Comparing:{" "}
            </span>
            <span style={{ color: colors.textDark, fontWeight: 600 }}>
              {comparison.previous.relative} → {comparison.latest.relative}
            </span>
          </div>
        ) : (
          <span style={{ flex: "1 1 auto" }} />
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          title={
            syncCooldownHint
              ? `${EMPTY_COPY.syncCooldownPrefix} (${syncCooldownHint})`
              : EMPTY_COPY.syncButton
          }
          style={{
            padding: "4px 10px",
            background: "transparent",
            color: colors.primary,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            cursor: refreshDisabled ? "not-allowed" : "pointer",
            opacity: refreshDisabled ? 0.6 : 1,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Sync Latest
        </button>
      </div>
    </div>
  );
};
