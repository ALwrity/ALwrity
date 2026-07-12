import React from 'react';

import { colors } from '../GrowthEngine/styles';
import type { EngagementSummary } from '../../../../services/postAnalyticsApi';

interface EngagementTrendsSummaryGridProps {
  summary: EngagementSummary;
}

const SummaryDeltaCard: React.FC<{
  icon: string;
  label: string;
  before: number;
  now: number;
  delta: number;
  pct: number;
  isRate?: boolean;
}> = ({ icon, label, before, now, delta, pct, isRate }) => {
  const up = delta >= 0;
  return (
    <div
      style={{
        flex: '1 1 calc(50% - 4px)',
        minWidth: 100,
        padding: '8px 10px',
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 2, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: up ? '#16a34a' : '#dc2626', marginBottom: 1 }}>
        {isRate ? `${now}%` : now.toLocaleString()}
      </div>
      <div style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1.35 }}>
        <span style={{ color: up ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
          {up ? '+' : ''}
          {isRate ? `${delta}pp` : delta.toLocaleString()}
        </span>
        {!isRate && pct !== 0 && (
          <span>
            {' '}
            ({up ? '+' : ''}
            {pct}%)
          </span>
        )}
        <span style={{ color: colors.textTertiary }}>
          {' '}
          from {isRate ? `${before}%` : before.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export const EngagementTrendsSummaryGrid: React.FC<EngagementTrendsSummaryGridProps> = ({ summary }) => (
  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
    <SummaryDeltaCard
      icon="❤️"
      label="Reactions"
      before={summary.reactions.before}
      now={summary.reactions.now}
      delta={summary.reactions.delta}
      pct={summary.reactions.pct_change}
    />
    <SummaryDeltaCard
      icon="💬"
      label="Comments"
      before={summary.comments.before}
      now={summary.comments.now}
      delta={summary.comments.delta}
      pct={summary.comments.pct_change}
    />
    <SummaryDeltaCard
      icon="👁️"
      label="Impressions"
      before={summary.impressions.before}
      now={summary.impressions.now}
      delta={summary.impressions.delta}
      pct={summary.impressions.pct_change}
    />
    <SummaryDeltaCard
      icon="📊"
      label="Avg ER"
      before={Math.round(summary.avg_engagement_rate_before * 100)}
      now={Math.round(summary.avg_engagement_rate_now * 100)}
      delta={Math.round(
        (summary.avg_engagement_rate_now - summary.avg_engagement_rate_before) * 100,
      )}
      pct={0}
      isRate
    />
  </div>
);
