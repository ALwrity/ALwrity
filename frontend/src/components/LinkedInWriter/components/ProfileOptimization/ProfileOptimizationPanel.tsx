import React from 'react';
import { CircularProgress } from '@mui/material';

import type {
  LinkedInProfileOptimizationItem,
  LinkedInProfileOptimizationMeta,
} from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';
import { ProfileOptimizationCard } from './ProfileOptimizationCard';

interface ProfileOptimizationPanelProps {
  isOpen: boolean;
  isLoading?: boolean;
  recommendations?: LinkedInProfileOptimizationItem[] | null;
  optimizationMeta?: LinkedInProfileOptimizationMeta | null;
  noGapsMessage?: string | null;
  onClose: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
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

/** Phase 7 — profile optimization recommendations panel. */
export const ProfileOptimizationPanel: React.FC<ProfileOptimizationPanelProps> = ({
  isOpen,
  isLoading = false,
  recommendations,
  optimizationMeta,
  noGapsMessage,
  onClose,
  onRefresh,
  isRefreshing = false,
}) => {
  if (!isOpen) {
    return null;
  }

  const showSkeleton = isLoading && !recommendations?.length;
  const showCards = !showSkeleton && recommendations && recommendations.length > 0;
  const showNoGaps = !showSkeleton && !showCards && Boolean(noGapsMessage);

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
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 6px',
                fontSize: 18,
                fontWeight: 700,
                color: '#1e293b',
              }}
            >
              Profile optimization suggestions
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.55 }}>
              Five high-impact improvements based on your profile gaps and LinkedIn best
              practices.
            </p>
            {optimizationMeta?.profile_optimization_updated_at && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Source: {optimizationMeta.source}
                {typeof optimizationMeta.remaining_in_backlog === 'number' &&
                  optimizationMeta.remaining_in_backlog > 0 &&
                  ` · ${optimizationMeta.remaining_in_backlog} more in backlog`}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onRefresh && showCards && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRefreshing ? 'wait' : 'pointer',
                }}
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
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
          </div>
        </div>

        {showSkeleton && (
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

        {showCards && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendations.map((item, index) => (
              <ProfileOptimizationCard key={item.id} recommendation={item} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
