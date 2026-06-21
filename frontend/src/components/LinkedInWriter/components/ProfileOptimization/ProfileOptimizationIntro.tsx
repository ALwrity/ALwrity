import React from 'react';

import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

interface ProfileOptimizationIntroProps {
  onClose?: () => void;
}

/** Step 0 placeholder — live recommendations arrive in Step 5. */
export const ProfileOptimizationIntro: React.FC<ProfileOptimizationIntroProps> = ({
  onClose,
}) => (
  <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
    <div
      style={{
        ...linkedInPlaceholderCardStyles.inner,
        minHeight: 'unset',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: 18,
              fontWeight: 700,
              color: '#1e293b',
            }}
          >
            Profile optimization suggestions
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.55, maxWidth: 560 }}>
            We will analyze your headline, summary, skills, and other profile sections against
            LinkedIn best practices and suggest five high-impact improvements at a time.
          </p>
          <p
            style={{
              margin: '12px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Profile suggestions will appear here after the next implementation step. Your profile
            foundation is loaded and ready.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile optimization panel"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  </div>
);
