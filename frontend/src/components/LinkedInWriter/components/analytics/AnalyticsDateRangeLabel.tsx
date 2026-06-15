import React from 'react';
import type { LinkedInAnalyticsDateRange } from '../../../../api/linkedinSocial';

interface AnalyticsDateRangeLabelProps {
  dateRange: LinkedInAnalyticsDateRange | null;
  dataDelayNote?: string | null;
}

export const AnalyticsDateRangeLabel: React.FC<AnalyticsDateRangeLabelProps> = ({
  dateRange,
}) => {
  if (!dateRange) return null;

  return (
    <p
      style={{
        margin: '12px 0 0',
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 1.5,
      }}
    >
      {dateRange.label} · Data may lag ~48h
    </p>
  );
};
