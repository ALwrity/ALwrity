import React from 'react';
import { CircularProgress } from '@mui/material';

import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

export type FoundationStatus =
  | 'loading'
  | 'ready'
  | 'needs_completion'
  | 'error';

interface LinkedInAdvisorActionsBarProps {
  foundationStatus: FoundationStatus;
  isTopicRunning: boolean;
  isOptimizationDisabled: boolean;
  onImproveProfile: () => void;
  onGetTopicIdeas: () => void;
}

function foundationStatusLabel(status: FoundationStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading profile analysis…';
    case 'ready':
      return 'Profile analysis ready';
    case 'needs_completion':
      return 'Complete your profile to unlock advisors';
    case 'error':
      return 'Profile analysis failed — retry below';
    default:
      return '';
  }
}

export const LinkedInAdvisorActionsBar: React.FC<LinkedInAdvisorActionsBarProps> = ({
  foundationStatus,
  isTopicRunning,
  isOptimizationDisabled,
  onImproveProfile,
  onGetTopicIdeas,
}) => {
  const advisorsDisabled =
    foundationStatus !== 'ready' || isTopicRunning || isOptimizationDisabled;

  return (
    <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
      <div
        style={{
          ...linkedInPlaceholderCardStyles.inner,
          minHeight: 'unset',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: foundationStatus === 'error' ? '#b91c1c' : '#334155',
            }}
          >
            {foundationStatus === 'loading' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CircularProgress size={14} sx={{ color: '#0A66C2' }} />
                {foundationStatusLabel(foundationStatus)}
              </span>
            )}
            {foundationStatus !== 'loading' && foundationStatusLabel(foundationStatus)}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onImproveProfile}
            disabled={advisorsDisabled}
            title={
              isOptimizationDisabled
                ? 'Complete your profile first'
                : 'Profile optimization suggestions (coming in Step 5)'
            }
            style={{
              background: advisorsDisabled
                ? '#94a3b8'
                : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: advisorsDisabled ? 'not-allowed' : 'pointer',
              boxShadow: advisorsDisabled
                ? 'none'
                : '0 4px 15px rgba(10, 102, 194, 0.35)',
              opacity: advisorsDisabled ? 0.75 : 1,
            }}
          >
            Improve My Profile
          </button>

          <button
            type="button"
            onClick={onGetTopicIdeas}
            disabled={foundationStatus !== 'ready' || isTopicRunning}
            style={{
              background: '#fff',
              border: '2px solid #0A66C2',
              borderRadius: 12,
              padding: '10px 22px',
              color: '#0A66C2',
              fontSize: 14,
              fontWeight: 700,
              cursor:
                foundationStatus !== 'ready' || isTopicRunning ? 'not-allowed' : 'pointer',
              opacity: foundationStatus !== 'ready' || isTopicRunning ? 0.65 : 1,
            }}
          >
            {isTopicRunning ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CircularProgress size={16} sx={{ color: '#0A66C2' }} />
                Getting topic ideas…
              </span>
            ) : (
              'Get Topic Ideas'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
