import React, { useMemo } from 'react';

import { colors } from '../GrowthEngine/styles';
import {
  formatLocalizedComparisonPeriod,
  formatLocalizedRelativeTime,
  getUserTimeZone,
} from './engagementTrendsLocaleFormat';

export interface EngagementTrendsMetadataFooterProps {
  lastSyncedAt?: string | null;
  period?: { from: string; to: string } | null;
  showComparison: boolean;
  onRefresh: () => void;
  loading: boolean;
}

/** Lower-priority sync metadata — shown below actionable trend insights. */
export const EngagementTrendsMetadataFooter: React.FC<EngagementTrendsMetadataFooterProps> = ({
  lastSyncedAt,
  period,
  showComparison,
  onRefresh,
  loading,
}) => {
  const comparison = useMemo(
    () => (period && showComparison ? formatLocalizedComparisonPeriod(period.from, period.to) : null),
    [period, showComparison],
  );
  const timeZone = getUserTimeZone().replace(/_/g, ' ');

  if (!lastSyncedAt && !comparison) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: '8px 10px',
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 10,
        color: colors.textSecondary,
        lineHeight: 1.45,
      }}
    >
      {lastSyncedAt && (
        <div style={{ marginBottom: comparison ? 6 : 0 }}>
          <span style={{ fontWeight: 700, color: colors.textTertiary }}>Last fetch: </span>
          <span style={{ color: colors.textDark, fontWeight: 600 }}>
            {formatLocalizedRelativeTime(lastSyncedAt)}
          </span>
        </div>
      )}
      {comparison && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: colors.textTertiary }}>Compared: </span>
          <span>{comparison.previous.display}</span>
          <span style={{ margin: '0 4px', color: colors.textTertiary }}>→</span>
          <span>{comparison.latest.display}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 9, color: colors.textTertiary }}>Times in {timeZone}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: '4px 10px',
            background: 'transparent',
            color: colors.primary,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          ⟳ Refresh analytics
        </button>
      </div>
    </div>
  );
};
