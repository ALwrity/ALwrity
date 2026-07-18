import React from 'react';

import { colors } from '../GrowthEngine/styles';
import { TAB_COPY } from './engagementTrendsCopy';
import type { EngagementPostTab } from './engagementTrendsPeriodUtils';

const TABS: EngagementPostTab[] = ['top', 'rising', 'falling'];

export interface EngagementTrendsPostTabsProps {
  value: EngagementPostTab;
  onChange: (tab: EngagementPostTab) => void;
  counts?: Partial<Record<EngagementPostTab, number>>;
  disabled?: boolean;
}

export const EngagementTrendsPostTabs: React.FC<EngagementTrendsPostTabsProps> = ({
  value,
  onChange,
  counts,
  disabled = false,
}) => (
  <div style={{ marginBottom: 10 }}>
    <div
      role="tablist"
      aria-label="Post performance views"
      style={{
        display: 'flex',
        gap: 4,
        padding: 3,
        background: colors.rowBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
      }}
    >
      {TABS.map((tab) => {
        const selected = value === tab;
        const count = counts?.[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            title={TAB_COPY[tab].hint}
            onClick={() => onChange(tab)}
            style={{
              flex: 1,
              padding: '7px 8px',
              border: 'none',
              borderRadius: 8,
              background: selected ? '#fff' : 'transparent',
              boxShadow: selected ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
              color: selected ? colors.textDark : colors.textSecondary,
              fontSize: 12,
              fontWeight: selected ? 800 : 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {TAB_COPY[tab].label}
            {typeof count === 'number' ? (
              <span style={{ marginLeft: 4, fontWeight: 600, color: colors.textTertiary }}>
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
    <div style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary }}>
      {TAB_COPY[value].hint}
    </div>
  </div>
);
