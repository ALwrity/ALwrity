import React from 'react';
import { CircularProgress } from '@mui/material';

import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

interface ProfileOptimizationIntroProps {
  isRunning?: boolean;
  onRunOptimization?: () => void;
}

/** Phase 7 — value prop shown before the user opens profile optimization suggestions. */
export const ProfileOptimizationIntro: React.FC<ProfileOptimizationIntroProps> = ({
  isRunning = false,
  onRunOptimization,
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
        Improve your LinkedIn profile with AI
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: '#64748b', maxWidth: 520, lineHeight: 1.55 }}>
        We compare your headline, summary, experience, skills, and other sections against LinkedIn
        best practices — then suggest five high-impact improvements you can apply right away.
      </p>
      {isRunning ? (
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
          Analysing your profile for optimisation opportunities…
        </div>
      ) : (
        onRunOptimization && (
          <button
            type="button"
            onClick={onRunOptimization}
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
            Optimise Profile
          </button>
        )
      )}
    </div>
  </div>
);
