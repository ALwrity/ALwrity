import React from 'react';

import { colors } from '../GrowthEngine/styles';
import { PERIOD_CHIP_LABELS } from './engagementTrendsCopy';
import {
  ENGAGEMENT_PERIOD_KEYS,
  type EngagementPeriodKey,
} from './engagementTrendsPeriodUtils';

export interface EngagementTrendsPeriodChipsProps {
  value: EngagementPeriodKey;
  onChange: (period: EngagementPeriodKey) => void;
  disabled?: boolean;
}

export const EngagementTrendsPeriodChips: React.FC<EngagementTrendsPeriodChipsProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <div
    role="group"
    aria-label="Time range"
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    }}
  >
    {ENGAGEMENT_PERIOD_KEYS.map((key) => {
      const selected = value === key;
      return (
        <button
          key={key}
          type="button"
          disabled={disabled}
          aria-pressed={selected}
          onClick={() => onChange(key)}
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            border: `1px solid ${selected ? colors.primary : colors.border}`,
            background: selected ? '#eff6ff' : colors.rowBg,
            color: selected ? colors.primary : colors.textSecondary,
            fontSize: 11,
            fontWeight: selected ? 700 : 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            lineHeight: 1.2,
          }}
        >
          {PERIOD_CHIP_LABELS[key]}
        </button>
      );
    })}
  </div>
);
