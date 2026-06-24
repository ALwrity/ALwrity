import React from 'react';
import { CircularProgress } from '@mui/material';

import type {
  LinkedInProfileOptimizationItem,
  LinkedInProfileOptimizationMeta,
} from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';
import { formatRelativeUpdatedAt } from '../TopicRecommendations/topicRecommendationLabels';
import { ProfileOptimizationCard } from './ProfileOptimizationCard';
import { ProfileOptimizationSummaryBar } from './ProfileOptimizationSummaryBar';

interface ProfileOptimizationPanelProps {
  isOpen: boolean;
  isLoading?: boolean;
  recommendations?: LinkedInProfileOptimizationItem[] | null;
  optimizationMeta?: LinkedInProfileOptimizationMeta | null;
  noGapsMessage?: string | null;
  isExpanded?: boolean;
  isRefreshing?: boolean;
  showNextBatchCta?: boolean;
  isLoadingNextBatch?: boolean;
  markingRecommendationId?: string | null;
  onCollapse?: () => void;
  onExpand?: () => void;
  onRefresh?: () => void;
  onMarkDone?: (recommendationId: string) => void;
  onSkip?: (recommendationId: string) => void;
  onLoadNextBatch?: () => void;
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

const hideSuggestionsButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const panelBackgroundGlowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-50%',
  left: '-50%',
  width: '200%',
  height: '200%',
  background:
    'radial-gradient(circle, rgba(10, 102, 194, 0.06) 0%, transparent 70%)',
  zIndex: 0,
};

/** Phase 7 — profile optimization recommendations panel. */
export const ProfileOptimizationPanel: React.FC<ProfileOptimizationPanelProps> = ({
  isOpen,
  isLoading = false,
  recommendations,
  optimizationMeta,
  noGapsMessage,
  isExpanded = true,
  isRefreshing = false,
  showNextBatchCta = false,
  isLoadingNextBatch = false,
  markingRecommendationId = null,
  onCollapse,
  onExpand,
  onRefresh,
  onMarkDone,
  onSkip,
  onLoadNextBatch,
}) => {
  if (!isOpen) {
    return null;
  }

  const updatedLabel = formatRelativeUpdatedAt(
    optimizationMeta?.profile_optimization_updated_at
  );
  const recommendationCount = recommendations?.length ?? 0;
  const showSkeleton = isLoading && !recommendations?.length;
  const showCards = !showSkeleton && recommendations && recommendations.length > 0;
  const showNoGaps = !showSkeleton && !showCards && Boolean(noGapsMessage);
  const showNextBatchBanner =
    !showSkeleton && !showCards && !showNoGaps && showNextBatchCta && Boolean(onLoadNextBatch);

  if (!isExpanded && (showCards || showNextBatchBanner) && onExpand) {
    return (
      <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
        <div
          style={{
            ...linkedInPlaceholderCardStyles.inner,
            minHeight: 'unset',
            padding: '16px 20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={panelBackgroundGlowStyle} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <ProfileOptimizationSummaryBar
              recommendationCount={recommendationCount}
              updatedLabel={updatedLabel}
              isRefreshing={isRefreshing}
              onExpand={onExpand}
              onRefresh={onRefresh}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
      <div
        style={{
          ...linkedInPlaceholderCardStyles.inner,
          minHeight: 'unset',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={panelBackgroundGlowStyle} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1e293b',
                }}
              >
                Profile optimization suggestions
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.55 }}>
                Five high-impact improvements based on your profile gaps and LinkedIn best
                practices.
              </p>
              {updatedLabel && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  {updatedLabel}
                  {optimizationMeta?.source ? ` · Source: ${optimizationMeta.source}` : ''}
                </p>
              )}
              {!updatedLabel && optimizationMeta?.source && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Source: {optimizationMeta.source}
                  {typeof optimizationMeta.remaining_in_backlog === 'number' &&
                    optimizationMeta.remaining_in_backlog > 0 &&
                    ` · ${optimizationMeta.remaining_in_backlog} more in backlog`}
                </p>
              )}
            </div>

            {showCards && onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                aria-expanded
                aria-controls="profile-optimization-list"
                style={hideSuggestionsButtonStyle}
              >
                Hide suggestions
              </button>
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#64748b',
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  <CircularProgress size={20} sx={{ color: '#0A66C2' }} />
                  Generating profile suggestions…
                </div>
                {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                  <div key={index} style={SKELETON_CARD_STYLE} aria-hidden />
                ))}
              </div>
            </>
          )}

          {showNoGaps && (
            <p
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: 8,
                backgroundColor: '#ecfdf5',
                border: '1px solid #6ee7b7',
                color: '#047857',
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {noGapsMessage}
            </p>
          )}

          {showNextBatchBanner && (
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 12,
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: '1 1 240px' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#1e3a8a',
                  }}
                >
                  Batch complete
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#1d4ed8', lineHeight: 1.5 }}>
                  {optimizationMeta?.remaining_in_backlog ?? 0} more recommendation
                  {(optimizationMeta?.remaining_in_backlog ?? 0) === 1 ? '' : 's'} waiting in
                  your backlog.
                </p>
              </div>
              <button
                type="button"
                onClick={onLoadNextBatch}
                disabled={isLoadingNextBatch}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: isLoadingNextBatch
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isLoadingNextBatch ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isLoadingNextBatch ? 'Loading…' : 'Get your next 5 recommendations'}
              </button>
            </div>
          )}

          {showCards && (
            <div
              id="profile-optimization-list"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {recommendations.map((item, index) => (
                <ProfileOptimizationCard
                  key={item.id}
                  recommendation={item}
                  index={index}
                  onMarkDone={onMarkDone}
                  onSkip={onSkip}
                  isMarking={markingRecommendationId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
