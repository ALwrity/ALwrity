import React from 'react';
import { CONFIDENCE_COLORS, colors } from './styles';

interface DataSourceBadgeProps {
  label: string;
  detail?: string;
  confidence?: 'high' | 'medium' | 'low';
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = React.memo(({
  label,
  detail,
  confidence,
}) => {
  const cc = confidence ? CONFIDENCE_COLORS[confidence] : null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 6,
        background: colors.badgeBg,
        fontSize: 11,
        color: colors.textMedium,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>📊 {label}</span>
      {detail && (
        <span style={{ opacity: 0.75, whiteSpace: 'nowrap' }}>· {detail}</span>
      )}
      {cc && (
        <span
          style={{
            background: cc.bg,
            color: cc.text,
            padding: '1px 6px',
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {CONFIDENCE_LABELS[confidence!]} confidence
        </span>
      )}
    </div>
  );
});