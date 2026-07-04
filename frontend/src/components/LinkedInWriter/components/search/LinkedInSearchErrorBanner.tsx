import React from 'react';

import type { LinkedInSearchErrorType } from './linkedinSearchTypes';

interface LinkedInSearchErrorBannerProps {
  message: string;
  errorType?: LinkedInSearchErrorType | null;
  onConnectClick?: () => void;
}

export const LinkedInSearchErrorBanner: React.FC<LinkedInSearchErrorBannerProps> = ({
  message,
  errorType,
  onConnectClick,
}) => {
  const isNotConnected = errorType === 'not_connected';

  const background = isNotConnected
    ? '#fef3c7'
    : '#fee2e2';

  const borderColor = isNotConnected
    ? '#f59e0b'
    : '#ef4444';

  const textColor = isNotConnected ? '#92400e' : '#991b1b';

  return (
    <div
      role="alert"
      style={{
        margin: '16px 20px',
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background,
        color: textColor,
        fontSize: 14,
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span>{message}</span>
      {isNotConnected && onConnectClick && (
        <button
          type="button"
          onClick={onConnectClick}
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderRadius: 20,
            border: 'none',
            background: '#0a66c2',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Connect LinkedIn
        </button>
      )}
    </div>
  );
};
