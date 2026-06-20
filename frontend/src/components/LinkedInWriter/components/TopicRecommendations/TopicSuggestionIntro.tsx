import React from 'react';
import { CircularProgress } from '@mui/material';

import type { LinkedInProfileAnalysisError } from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

interface AnalysisErrorAlertProps {
  error: LinkedInProfileAnalysisError;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const AnalysisErrorAlert: React.FC<AnalysisErrorAlertProps> = ({
  error,
  onRetry,
  isRetrying = false,
}) => (
  <div
    role="alert"
    style={{
      marginTop: 16,
      padding: '12px 14px',
      borderRadius: 8,
      backgroundColor: '#fffbeb',
      border: '1px solid #fde68a',
      color: '#92400e',
      fontSize: 13,
      lineHeight: 1.5,
      maxWidth: 1200,
    }}
  >
    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{error.user_message}</p>
    <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
      Failed at Phase {error.failed_phase}: {error.phase_label} ({error.error_code})
    </p>
    {process.env.NODE_ENV === 'development' && error.debug_message && (
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          color: '#78716c',
          fontFamily: 'monospace',
          wordBreak: 'break-word',
        }}
      >
        {error.debug_message}
      </p>
    )}
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        style={{
          marginTop: 12,
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid #f59e0b',
          backgroundColor: '#fff',
          color: '#92400e',
          fontSize: 13,
          fontWeight: 600,
          cursor: isRetrying ? 'default' : 'pointer',
          opacity: isRetrying ? 0.7 : 1,
        }}
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    )}
  </div>
);

interface TopicSuggestionIntroProps {
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

export const TopicSuggestionIntro: React.FC<TopicSuggestionIntroProps> = ({
  isAnalyzing,
  onRunAnalysis,
}) => (
  <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
    <div
      style={{
        ...linkedInPlaceholderCardStyles.inner,
        minHeight: 'unset',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 14,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: '#1e293b',
        }}
      >
        Personalized topic ideas for your LinkedIn profile
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: '#64748b', maxWidth: 480, lineHeight: 1.55 }}>
        Analyze your profile to get five tailored content ideas based on your expertise and
        audience.
      </p>
      {isAnalyzing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          <CircularProgress size={22} sx={{ color: '#0A66C2' }} />
          Analyzing your LinkedIn profile…
        </div>
      ) : (
        <button
          type="button"
          onClick={onRunAnalysis}
          style={{
            background: 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
            border: 'none',
            borderRadius: 12,
            padding: '12px 28px',
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(10, 102, 194, 0.35)',
          }}
        >
          Topic Suggestion
        </button>
      )}
    </div>
  </div>
);
