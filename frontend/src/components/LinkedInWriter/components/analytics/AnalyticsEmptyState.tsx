import React from 'react';

interface AnalyticsEmptyStateProps {
  message: string;
}

export const AnalyticsEmptyState: React.FC<AnalyticsEmptyStateProps> = ({ message }) => (
  <p
    role="status"
    style={{
      margin: '24px 0 0',
      padding: '16px',
      borderRadius: 10,
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      color: '#64748b',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 1.5,
    }}
  >
    {message}
  </p>
);
