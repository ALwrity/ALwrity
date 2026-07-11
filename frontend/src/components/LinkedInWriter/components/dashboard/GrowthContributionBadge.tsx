import React from 'react';

import { GROWTH_CONTRIBUTION_TOOLTIP } from './engagementTrendsModalLayout';

interface GrowthContributionBadgeProps {
  contributionPct: number;
}

export const GrowthContributionBadge: React.FC<GrowthContributionBadgeProps> = ({ contributionPct }) => (
  <div
    title={GROWTH_CONTRIBUTION_TOOLTIP}
    aria-label={`${contributionPct}% of engagement growth. ${GROWTH_CONTRIBUTION_TOOLTIP}`}
    style={{
      flexShrink: 0,
      textAlign: 'right',
      padding: '3px 7px',
      background: '#dcfce7',
      border: '1px solid #86efac',
      borderRadius: 8,
      maxWidth: 108,
      cursor: 'help',
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', lineHeight: 1.2 }}>
      {contributionPct}% of growth
    </div>
    <div style={{ fontSize: 8, fontWeight: 600, color: '#166534', marginTop: 1, lineHeight: 1.2 }}>
      Key growth driver
    </div>
  </div>
);
