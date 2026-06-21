import React from 'react';

import type {
  LinkedInTopicRecommendation,
  LinkedInTopicRecommendationsMeta,
  LinkedInProfileAnalysisError,
} from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';
import { TopicRecommendationCard } from './TopicRecommendationCard';
import { formatRelativeUpdatedAt } from './topicRecommendationLabels';
import { AnalysisErrorAlert } from './TopicSuggestionIntro';

interface TopicRecommendationsPanelProps {
  recommendations: LinkedInTopicRecommendation[] | null;
  recommendationsMeta: LinkedInTopicRecommendationsMeta | null;
  recommendationsError: string | null;
  analysisError?: LinkedInProfileAnalysisError | null;
  isRefreshing?: boolean;
  onRetry?: () => void;
}

const SKELETON_CARD_STYLE: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  minHeight: 120,
  background:
    'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '200% 100%',
  animation: 'linkedinTopicRecShimmer 1.2s ease-in-out infinite',
};

const SKELETON_COUNT = 3;

export const TopicRecommendationsPanel: React.FC<TopicRecommendationsPanelProps> = ({
  recommendations,
  recommendationsMeta,
  recommendationsError,
  analysisError = null,
  isRefreshing = false,
  onRetry,
}) => {
  const updatedLabel = formatRelativeUpdatedAt(
    recommendationsMeta?.recommendations_updated_at
  );
  const showSkeleton = isRefreshing && !recommendations?.length;
  const displayError = analysisError?.user_message ?? recommendationsError;
  const showError = Boolean(displayError) && !showSkeleton;
  const showEmpty =
    !showSkeleton && !showError && (!recommendations || recommendations.length === 0);

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
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background:
              'radial-gradient(circle, rgba(10, 102, 194, 0.06) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#1e293b',
              }}
            >
              What to write next
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
              Five ideas tailored to your profile
            </p>
            {updatedLabel && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                {updatedLabel}
              </p>
            )}
          </div>

          {showSkeleton && (
            <>
              <style>{`
                @keyframes linkedinTopicRecShimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                  <div key={index} style={SKELETON_CARD_STYLE} aria-hidden />
                ))}
              </div>
            </>
          )}

          {showError && analysisError && (
            <AnalysisErrorAlert
              error={analysisError}
              onRetry={onRetry}
              isRetrying={isRefreshing}
            />
          )}

          {showError && !analysisError && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 13,
                lineHeight: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ flex: '1 1 240px' }}>{displayError}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={isRefreshing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #f59e0b',
                    backgroundColor: '#fff',
                    color: '#92400e',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isRefreshing ? 'default' : 'pointer',
                    opacity: isRefreshing ? 0.7 : 1,
                  }}
                >
                  {isRefreshing ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          )}

          {showEmpty && (
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
              No content suggestions are available yet. Try again in a moment.
            </p>
          )}

          {!showSkeleton && !showError && recommendations && recommendations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommendations.map((item, index) => (
                <TopicRecommendationCard
                  key={item.id}
                  recommendation={item}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
