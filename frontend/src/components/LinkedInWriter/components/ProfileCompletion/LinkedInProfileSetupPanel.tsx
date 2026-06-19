import React from 'react';
import { CircularProgress } from '@mui/material';

import { useLinkedInProfileCompletion } from '../../../../hooks/useLinkedInProfileCompletion';
import { LinkedInConnectedProfileCard } from '../LinkedInConnectedProfileCard';
import { ProfileCompletionForm } from './ProfileCompletionForm';

interface LinkedInProfileSetupPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
}

export const LinkedInProfileSetupPanel: React.FC<LinkedInProfileSetupPanelProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
}) => {
  const {
    isLoading,
    error,
    questions,
    isProfileComplete,
    isSubmitting,
    submitError,
    submitCompletion,
    refresh,
  } = useLinkedInProfileCompletion(true);

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <LinkedInConnectedProfileCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={onDisconnect}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
      />

      {isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 16,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          <CircularProgress size={22} sx={{ color: '#0A66C2' }} />
          Loading profile...
        </div>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          style={{
            margin: '16px 0 0',
            padding: '12px 14px',
            borderRadius: 8,
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: 13,
            lineHeight: 1.5,
            maxWidth: 1200,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ flex: '1 1 240px' }}>{error}</span>
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #f59e0b',
              backgroundColor: '#fff',
              color: '#92400e',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !isProfileComplete && questions.length > 0 && (
        <ProfileCompletionForm
          questions={questions}
          onSubmit={submitCompletion}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      )}
    </div>
  );
};
