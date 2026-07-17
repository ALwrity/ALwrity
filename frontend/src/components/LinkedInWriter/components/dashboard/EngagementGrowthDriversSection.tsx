import React, { useMemo } from 'react';

import type { EngagementSummary } from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { formatLocalizedComparisonPeriod } from './engagementTrendsLocaleFormat';
import {
  GROWTH_CONTRIBUTION_TOOLTIP,
  GROWTH_DRIVERS_CONTRIBUTION_HINT,
} from './engagementTrendsCopy';

export interface EngagementGrowthDriversSectionProps {
  period: { from: string; to: string };
  summary: EngagementSummary;
  showContributionBadges: boolean;
  children: React.ReactNode;
}

function formatSignedDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return value.toLocaleString();
  return '0';
}

function buildOverallGrowthLine(summary: EngagementSummary): string {
  const parts: string[] = [];
  const { reactions, comments, impressions, followers } = summary;

  if (reactions.delta !== 0) {
    parts.push(`${formatSignedDelta(reactions.delta)} reactions`);
  }
  if (comments.delta !== 0) {
    parts.push(`${formatSignedDelta(comments.delta)} comments`);
  }
  if (impressions.delta !== 0) {
    parts.push(`${formatSignedDelta(impressions.delta)} impressions`);
  }
  if (followers && followers.delta !== 0) {
    parts.push(`${formatSignedDelta(followers.delta)} followers from posts`);
  }

  if (parts.length === 0) {
    return 'No net change across reactions, comments, or impressions in this period.';
  }

  return `Overall: ${parts.join(' · ')}.`;
}

export const EngagementGrowthDriversSection: React.FC<EngagementGrowthDriversSectionProps> = ({
  period,
  summary,
  showContributionBadges,
  children,
}) => {
  const comparison = useMemo(
    () => formatLocalizedComparisonPeriod(period.from, period.to),
    [period.from, period.to],
  );

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#16a34a',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        Growth drivers
      </div>

      <div
        style={{
          marginBottom: 8,
          padding: '8px 10px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          fontSize: 11,
          color: colors.textSecondary,
          lineHeight: 1.4,
        }}
      >
        <p style={{ margin: '0 0 4px', color: colors.textDark, fontWeight: 600 }}>
          Posts driving growth between{' '}
          <span style={{ color: '#15803d' }}>{comparison.previous.display}</span> and{' '}
          <span style={{ color: '#15803d' }}>{comparison.latest.display}</span>.
        </p>
        {showContributionBadges && (
          <p style={{ margin: '0 0 4px' }} title={GROWTH_CONTRIBUTION_TOOLTIP}>
            {GROWTH_DRIVERS_CONTRIBUTION_HINT}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#166534' }}>
          {buildOverallGrowthLine(summary)}
        </p>
      </div>

      {children}
    </div>
  );
};
