import React from 'react';
import { colors, primaryBtn } from './styles';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

function classifyErrorMessage(message: string): { title: string; hint: string } {
  const lower = message.toLowerCase();

  if (lower.includes('not connected') || lower.includes('not_connected')) {
    return {
      title: 'LinkedIn not connected',
      hint: 'Connect your personal LinkedIn profile in settings, then try again.',
    };
  }

  if (lower.includes('rate limit') || lower.includes('429')) {
    return {
      title: 'Too many requests',
      hint: 'LinkedIn rate limits apply. Wait a moment and try again.',
    };
  }

  if (lower.includes('recipient') || lower.includes('unreachable') || lower.includes('502')) {
    return {
      title: 'Could not reach your profile',
      hint: 'Try reconnecting your LinkedIn account, then refresh this page.',
    };
  }

  if (lower.includes('401') || lower.includes('unauthorized')) {
    return {
      title: 'Session expired',
      hint: 'Sign in again and retry loading your posts.',
    };
  }

  return {
    title: 'Could not load posts',
    hint: message || 'Something went wrong while fetching your posts.',
  };
}

export const ErrorState: React.FC<ErrorStateProps> = React.memo(({ message, onRetry, retrying }) => {
  const { title, hint } = classifyErrorMessage(message);

  return (
    <div
      role="alert"
      style={{
        background: colors.errorBg,
        border: `1px solid ${colors.errorBorder}`,
        borderRadius: 12,
        padding: '20px 24px',
        color: colors.errorText,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, color: '#b91c1c' }}>
        {hint}
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        style={{
          ...primaryBtn,
          opacity: retrying ? 0.7 : 1,
          cursor: retrying ? 'not-allowed' : 'pointer',
        }}
      >
        {retrying ? 'Retrying…' : 'Try Again'}
      </button>
    </div>
  );
});

ErrorState.displayName = 'PostAnalyticsErrorState';
