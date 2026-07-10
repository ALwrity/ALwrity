import React, { useMemo } from 'react';

import { colors } from '../GrowthEngine/styles';
import {
  formatLocalizedComparisonPeriod,
  formatLocalizedDateTime,
  formatLocalizedRelativeTime,
  getUserTimeZone,
} from './engagementTrendsLocaleFormat';

export const LastUpdatedBanner: React.FC<{
  lastSyncedAt: string;
  onRefresh: () => void;
  loading: boolean;
}> = ({ lastSyncedAt, onRefresh, loading }) => {
  const relative = formatLocalizedRelativeTime(lastSyncedAt);
  const absolute = formatLocalizedDateTime(lastSyncedAt);
  const timeZone = getUserTimeZone();

  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 14,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 8,
        fontSize: 12,
        color: '#0369a1',
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Last LinkedIn fetch</div>
      <span>
        Analytics were last fetched from LinkedIn{' '}
        <strong>{relative}</strong> ({absolute}).
        Refresh to pull current metrics and compare against your previous snapshot.
      </span>
      <div style={{ fontSize: 11, color: '#0284c7', marginTop: 6 }}>
        Times shown in your local timezone ({timeZone.replace(/_/g, ' ')}).
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        style={{
          display: 'block',
          marginTop: 8,
          padding: '6px 12px',
          background: colors.primary,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        ⟳ Refresh Analytics
      </button>
    </div>
  );
};

export const ComparisonPeriodBlock: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const period = useMemo(() => formatLocalizedComparisonPeriod(from, to), [from, to]);

  return (
    <div
      style={{
        marginBottom: 14,
        padding: '10px 12px',
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        Comparison period
      </div>
      <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>
        Local timezone: {period.timeZoneLabel}
      </div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: colors.textDark }}>Previous snapshot: </span>
        {period.previous.display}
      </div>
      <div>
        <span style={{ fontWeight: 600, color: colors.textDark }}>Latest snapshot: </span>
        {period.latest.display}
      </div>
    </div>
  );
};
