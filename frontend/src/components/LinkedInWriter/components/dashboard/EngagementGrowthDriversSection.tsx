import React, { useMemo } from 'react';

import type { EngagementSummary } from '../../../../services/postAnalyticsApi';
import { colors } from '../GrowthEngine/styles';
import { GROWTH_CONTRIBUTION_TOOLTIP } from './engagementTrendsCopy';

export interface EngagementGrowthDriversSectionProps {
  summary: EngagementSummary;
  showContributionBadges: boolean;
  children: React.ReactNode;
}

function formatSignedDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return value.toLocaleString();
  return '0';
}

/** Highest-priority summary for Rising: what actually moved. */
function buildOverallGrowthLine(summary: EngagementSummary): string | null {
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

  if (parts.length === 0) return null;
  return `Overall growth: ${parts.join(' · ')}`;
}

/**
 * Rising-tab header. Comparison timestamps live in the footer only —
 * this block shows growth outcome, then the post list.
 */
export const EngagementGrowthDriversSection: React.FC<EngagementGrowthDriversSectionProps> = ({
  summary,
  showContributionBadges,
  children,
}) => {
  const overallLine = useMemo(() => buildOverallGrowthLine(summary), [summary]);

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#16a34a',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Growth drivers
        </div>
        {showContributionBadges && (
          <div
            title={GROWTH_CONTRIBUTION_TOOLTIP}
            style={{ fontSize: 10, color: colors.textTertiary, cursor: 'help' }}
          >
            Badges = share of growth
          </div>
        )}
      </div>

      {overallLine && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            color: '#166534',
            lineHeight: 1.4,
          }}
        >
          {overallLine}
        </div>
      )}

      {children}
    </div>
  );
};
