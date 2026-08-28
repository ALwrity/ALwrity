import React from 'react';

interface WizardRetryBarProps {
  retryStepNumber: number | null;
  progressMessage: string;
  retryStepCompletion: () => void;
  dismissRetry: () => void;
}

export const WizardRetryBar: React.FC<WizardRetryBarProps> = ({
  retryStepNumber,
  progressMessage,
  retryStepCompletion,
  dismissRetry,
}) => {
  if (retryStepNumber === null) return null;

  return (
    <div style={{
      margin: '0 16px 8px',
      padding: '12px 16px',
      borderRadius: 10,
      background: '#fef2f2',
      border: '1px solid #fecaca',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.05)',
      position: 'relative',
      zIndex: 3,
    }}>
      <span style={{ flex: 1, fontSize: '0.85rem', color: '#dc2626', fontWeight: 500 }}>
        {progressMessage}
      </span>
      <button
        onClick={retryStepCompletion}
        style={{
          padding: '6px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.8rem',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-0.5px)';
          e.currentTarget.style.boxShadow = '0 3px 6px rgba(220, 38, 38, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
        }}
      >
        Retry
      </button>
      <button
        onClick={dismissRetry}
        style={{
          padding: '6px 16px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: '#fff',
          color: '#6b7280',
          fontWeight: 600,
          fontSize: '0.8rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f9fafb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff';
        }}
      >
        Continue Anyway
      </button>
    </div>
  );
};
