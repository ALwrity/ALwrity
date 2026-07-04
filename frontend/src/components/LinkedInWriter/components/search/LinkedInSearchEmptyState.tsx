import React from 'react';

interface LinkedInSearchEmptyStateProps {
  message: string;
}

export const LinkedInSearchEmptyState: React.FC<LinkedInSearchEmptyStateProps> = ({ message }) => {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        color: '#475569',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} aria-hidden>
        🔍
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{message}</p>
    </div>
  );
};
