import React, { useMemo } from 'react';

import type { EngagementSummary } from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { formatLocalizedComparisonPeriod } from './engagementTrendsLocaleFormat';

export interface EngagementGrowthDriversSectionProps {
  period: { from: string; to: string };
  summary: EngagementSummary;
  children: React.ReactNode;
}

function formatSignedDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return value.toLocaleString();
  return '0';
}

function buildOverallGrowthLine(summary: EngagementSummary): string {
  const parts: string[] = [];
  const { reactions, comments, impressions } = summary;

  if (reactions.delta !== 0) {
    parts.push(`${formatSignedDelta(reactions.delta)} reactions`);
  }
  if (comments.delta !== 0) {
    parts.push(`${formatSignedDelta(comments.delta)} comments`);
  }
  if (impressions.delta !== 0) {
    parts.push(`${formatSignedDelta(impressions.delta)} impressions`);
  }

  if (parts.length === 0) {
    return 'No net change across reactions, comments, or impressions in this period.';
  }

  return `Overall growth this period: ${parts.join(' · ')}.`;
}

export const EngagementGrowthDriversSection: React.FC<EngagementGrowthDriversSectionProps> = ({
  period,
  summary,
  children,
}) => {
  const comparison = useMemo(
    () => formatLocalizedComparisonPeriod(period.from, period.to),
    [period.from, period.to],
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#16a34a',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        📈 Growth drivers
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: '0 0 8px', color: colors.textDark, fontWeight: 600 }}>
          These posts drove your engagement growth between{' '}
          <span style={{ color: '#15803d' }}>{comparison.previous.display}</span> and{' '}
          <span style={{ color: '#15803d' }}>{comparison.latest.display}</span>.
        </p>
        <p style={{ margin: '0 0 8px' }}>
          Percentages show each post&apos;s share of total positive growth (reactions + comments +
          impressions) across all posts in this comparison.
        </p>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#166534' }}>
          {buildOverallGrowthLine(summary)}
        </p>
      </div>

      {children}
    </div>
  );
};
