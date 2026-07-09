import React from 'react';

import { colors } from '../GrowthEngine/styles';
import { formatAbsoluteLocal, formatSnapshotMoment, formatTimeAgo } from './engagementTrendsTimeUtils';

export const LastUpdatedBanner: React.FC<{
  lastSyncedAt: string;
  onRefresh: () => void;
  loading: boolean;
}> = ({ lastSyncedAt, onRefresh, loading }) => (
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
      <strong>{formatTimeAgo(lastSyncedAt)}</strong> ({formatAbsoluteLocal(lastSyncedAt)}).
      Refresh to pull current metrics and compare against your previous snapshot.
    </span>
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

export const ComparisonPeriodBlock: React.FC<{ from: string; to: string }> = ({ from, to }) => (
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
        marginBottom: 8,
      }}
    >
      Comparison period
    </div>
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontWeight: 600, color: colors.textDark }}>Previous snapshot: </span>
      {formatSnapshotMoment(from)}
    </div>
    <div>
      <span style={{ fontWeight: 600, color: colors.textDark }}>Latest snapshot: </span>
      {formatSnapshotMoment(to)}
    </div>
  </div>
);
