import React from 'react';
import { CircularProgress } from '@mui/material';

import type {
  LinkedInAIProfileIntelligence,
  LinkedInProfileOptimizationItem,
  LinkedInProfileOptimizationMeta,
} from '../../../../api/linkedinSocial';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';
import { formatRelativeUpdatedAt } from '../TopicRecommendations/topicRecommendationLabels';
import { BrandIdentityCard } from './BrandIdentityCard';
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
  /** Feature 3 — AI-detected brand identity (Phase 5 intelligence). */
  aiProfileIntelligence?: LinkedInAIProfileIntelligence | null;
  /** Optional profile strength score to contextualize identity positioning. */
  profileStrengthPercent?: number | null;
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

// Feature 2 — Impact/Effort scoring for priority sorting
const IMPACT_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const EFFORT_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

/** Compute sort score: impact is primary, effort is secondary (lower effort = higher priority). */
function computePriorityScore(item: LinkedInProfileOptimizationItem): number {
  const impactScore = IMPACT_RANK[item.impact] ?? 99;
  const effortScore = EFFORT_RANK[item.effort] ?? 99;
  return impactScore * 10 + effortScore;
}

/** Find the best quick win: High impact + Low effort. */
function findQuickWin(
  items: LinkedInProfileOptimizationItem[]
): LinkedInProfileOptimizationItem | null {
  return (
    items.find((item) => item.impact === 'High' && item.effort === 'Low') ??
    items.find((item) => item.impact === 'High' && item.effort === 'Medium') ??
    items.find((item) => item.impact === 'Medium' && item.effort === 'Low') ??
    null
  );
}

/** Get human-readable effort label. */
function formatEffortTimeLabel(effort: string): string {
  switch (effort) {
    case 'Low':
      return 'Takes ~5 minutes';
    case 'Medium':
      return 'Takes ~20 minutes';
    case 'High':
      return 'Takes an afternoon';
    default:
      return '';
  }
}

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
  aiProfileIntelligence,
  profileStrengthPercent,
  onCollapse,
  onExpand,
  onRefresh,
  onMarkDone,
  onSkip,
  onLoadNextBatch,
}) => {
  // Feature 2 — Sort recommendations by impact × effort priority (must be before early return)
  const sortedRecommendations = React.useMemo(() => {
    if (!recommendations) return [];
    return [...recommendations].sort(
      (a, b) => computePriorityScore(a) - computePriorityScore(b)
    );
  }, [recommendations]);

  // Feature 2 — Identify the single best quick win
  const quickWin = React.useMemo(() => {
    if (!recommendations) return null;
    return findQuickWin(recommendations);
  }, [recommendations]);

  // Feature 2 — Remaining items (excluding quick win for separate rendering)
  const remainingItems = React.useMemo(() => {
    if (!quickWin) return sortedRecommendations;
    return sortedRecommendations.filter((item) => item.id !== quickWin.id);
  }, [sortedRecommendations, quickWin]);

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
          {aiProfileIntelligence && (
            <BrandIdentityCard
              intelligence={aiProfileIntelligence}
              profileStrengthPercent={profileStrengthPercent}
            />
          )}

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
                {quickWin
                  ? "We've prioritized your recommendations by impact and effort — start with the quick win below."
                  : 'Five high-impact improvements based on your profile gaps and LinkedIn best practices.'}
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
              {/* Feature 2 — Quick Win Card with "⚡ Do This First" badge */}
              {quickWin && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
                    border: '2px solid #facc15',
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 999,
                      backgroundColor: '#facc15',
                      color: '#713f12',
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>⚡</span>
                    Do This First
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        backgroundColor: '#fff',
                        color: '#a16207',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {formatEffortTimeLabel(quickWin.effort)}
                    </span>
                  </div>
                  <ProfileOptimizationCard
                    recommendation={quickWin}
                    index={0}
                    onMarkDone={onMarkDone}
                    onSkip={onSkip}
                    isMarking={markingRecommendationId === quickWin.id}
                    showEffortTimeLabel={formatEffortTimeLabel(quickWin.effort)}
                  />
                </div>
              )}

              {/* Feature 2 — Remaining recommendations sorted by impact */}
              {remainingItems.map((item, index) => (
                <ProfileOptimizationCard
                  key={item.id}
                  recommendation={item}
                  index={quickWin ? index + 1 : index}
                  onMarkDone={onMarkDone}
                  onSkip={onSkip}
                  isMarking={markingRecommendationId === item.id}
                  showEffortTimeLabel={formatEffortTimeLabel(item.effort)}
                />
              ))}
            </div>
          )}

          {/* Feature 5 — Profile → Content Bridge: Writing Opportunities Panel */}
          {showCards && aiProfileIntelligence?.writing_opportunities &&
            aiProfileIntelligence.writing_opportunities.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  padding: '18px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                  border: '1px solid #c4b5fd',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        margin: '0 0 4px',
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#5b21b6',
                      }}
                    >
                      Content angles from your profile
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#7c3aed',
                        lineHeight: 1.5,
                      }}
                    >
                      Your experience in {aiProfileIntelligence.industry && aiProfileIntelligence.industry !== 'Unknown'
                        ? aiProfileIntelligence.industry
                        : 'your industry'}
                      {aiProfileIntelligence.primary_expertise?.[0] && (
                        <> and expertise in <strong>{aiProfileIntelligence.primary_expertise[0]}</strong></>
                      )}{' '}
                      makes these content angles native to you — not generic topics.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {aiProfileIntelligence.writing_opportunities.slice(0, 5).map((opportunity, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        border: '1px solid #ddd6fe',
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: '#f3e8ff',
                          color: '#7c3aed',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: '#4c1d95',
                          fontWeight: 500,
                          lineHeight: 1.5,
                        }}
                      >
                        {opportunity}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Dispatch event to open Get Topic Ideas flow
                    window.dispatchEvent(new CustomEvent('linkedinwriter:getTopicIdeas'));
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Get topic ideas from these angles
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
