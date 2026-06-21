import React from 'react';
import { CircularProgress } from '@mui/material';

import type { LinkedInProfileOptimizationDebug } from '../../../../api/linkedinSocial';
import { AnalysisErrorAlert } from '../TopicRecommendations/TopicSuggestionIntro';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';

interface ProfileOptimizationIntroProps {
  onClose?: () => void;
  isLoading?: boolean;
  optimizationDebug?: LinkedInProfileOptimizationDebug | null;
}

/** Step 1 placeholder — shows rubric gap count; live recommendations arrive in Step 5. */
export const ProfileOptimizationIntro: React.FC<ProfileOptimizationIntroProps> = ({
  onClose,
  isLoading = false,
  optimizationDebug,
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
            We analyze your headline, summary, skills, and other profile sections against LinkedIn
            best practices and suggest five high-impact improvements at a time.
          </p>

          {isLoading && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#64748b',
                fontSize: 14,
              }}
            >
              <CircularProgress size={20} sx={{ color: '#0A66C2' }} />
              Detecting profile gaps…
            </div>
          )}

          {!isLoading && optimizationDebug && (
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
              Rubric found {optimizationDebug.detected_gaps_count} gap
              {optimizationDebug.detected_gaps_count === 1 ? '' : 's'}
              {optimizationDebug.rule_ids.length > 0 && (
                <>
                  {' '}
                  — top issues: {optimizationDebug.rule_ids.slice(0, 3).join(', ')}
                </>
              )}
              . Full AI recommendations arrive in the next step.
            </p>
          )}

          {!isLoading && !optimizationDebug && (
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
              Profile suggestions will appear here after the next implementation step.
            </p>
          )}
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
