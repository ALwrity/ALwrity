import React, { useRef } from 'react';
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
import { SectionScoresPanel } from './SectionScoresPanel';

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
  publicIdentifier?: string | null;
  sectionScores?: Record<string, number> | null;
  recheckDelta?: { previous: number; current: number } | null;
  isRechecking?: boolean;
  onRecheckProfile?: () => void;
  onDismissRecheckDelta?: () => void;
  /** AI-detected brand identity (Phase 5 intelligence). */
  aiProfileIntelligence?: LinkedInAIProfileIntelligence | null;
  profileStrengthPercent?: number | null;
  /** Current LinkedIn profile picture URL. */
  profilePictureUrl?: string | null;
  /** Uploaded local profile photo URL (from profile-photo/upload). */
  localProfilePhotoUrl?: string | null;
  /** Transformed profile photo URL (from make-presentable). */
  transformedProfilePhotoUrl?: string | null;
  /** Whether a photo upload is in progress. */
  uploadingProfilePhoto?: boolean;
  /** Error message from last photo upload attempt. */
  profilePhotoUploadError?: string | null;
  /** Called when user selects a file to upload. */
  onUploadProfilePhoto?: (file: File) => void;
  /** Whether the "Make Presentable" transform is in progress. */
  transformingProfilePhoto?: boolean;
  /** Error message from last transform attempt. */
  profilePhotoTransformError?: string | null;
  /** Called when user clicks "Make Presentable". */
  onMakeProfilePhotoPresentable?: () => void;
  /** Called when user clicks "Download Photo". */
  onDownloadProfilePhoto?: () => void;
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

const IMPACT_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const EFFORT_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

function computePriorityScore(item: LinkedInProfileOptimizationItem): number {
  const impactScore = IMPACT_RANK[item.impact] ?? 99;
  const effortScore = EFFORT_RANK[item.effort] ?? 99;
  return impactScore * 10 + effortScore;
}

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

/** Phase 7 ΓÇö profile optimization recommendations panel. */
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
  publicIdentifier = null,
  sectionScores = null,
  recheckDelta = null,
  isRechecking = false,
  onRecheckProfile,
  onDismissRecheckDelta,
  aiProfileIntelligence,
  profileStrengthPercent,
  profilePictureUrl,
  localProfilePhotoUrl,
  transformedProfilePhotoUrl,
  uploadingProfilePhoto = false,
  profilePhotoUploadError = null,
  onUploadProfilePhoto,
  transformingProfilePhoto = false,
  profilePhotoTransformError = null,
  onMakeProfilePhotoPresentable,
  onDownloadProfilePhoto,
  onCollapse,
  onExpand,
  onRefresh,
  onMarkDone,
  onSkip,
  onLoadNextBatch,
}) => {
  const activeSectionKeys = React.useMemo(() => {
    if (!recommendations) {
      return null;
    }
    return new Set(recommendations.map((item) => item.profile_section));
  }, [recommendations]);

  const activeSectionCount = React.useMemo(() => {
    if (!recommendations) {
      return null;
    }
    const map = new Map<string, number>();
    for (const item of recommendations) {
      map.set(item.profile_section, (map.get(item.profile_section) ?? 0) + 1);
    }
    return map;
  }, [recommendations]);

  const sortedRecommendations = React.useMemo(() => {
    if (!recommendations) return [];
    return [...recommendations].sort(
      (a, b) => computePriorityScore(a) - computePriorityScore(b)
    );
  }, [recommendations]);

  const quickWin = React.useMemo(() => {
    if (!recommendations) return null;
    return findQuickWin(recommendations);
  }, [recommendations]);

  const remainingItems = React.useMemo(() => {
    if (!quickWin) return sortedRecommendations;
    return sortedRecommendations.filter((item) => item.id !== quickWin.id);
  }, [sortedRecommendations, quickWin]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAllAngles, setShowAllAngles] = React.useState(false);
  const VISIBLE_ANGLES_COUNT = 3;
  const writingOpportunities = aiProfileIntelligence?.writing_opportunities ?? [];
  const visibleOpportunities = showAllAngles
    ? writingOpportunities
    : writingOpportunities.slice(0, VISIBLE_ANGLES_COUNT);
  const hiddenCount = Math.max(0, writingOpportunities.length - VISIBLE_ANGLES_COUNT);
  const contentBridgeIndustry =
    aiProfileIntelligence?.industry && aiProfileIntelligence.industry !== 'Unknown'
      ? aiProfileIntelligence.industry
      : 'your industry';
  const contentBridgeExpertise = aiProfileIntelligence?.primary_expertise?.[0];

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

  const showSectionScores = Boolean(sectionScores) && (showCards || showNextBatchBanner);

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
    <>
      <style>{`
        @media (max-width: 480px) {
          .profile-opt-panel {
            padding: 12px !important;
          }
          .profile-opt-flex-row {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .profile-opt-flex-item {
            flex: 1 1 auto !important;
            width: 100% !important;
          }
        }
      `}</style>
    <div className="profile-opt-panel" style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
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

          {/* Profile Photo Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              borderRadius: 12,
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {localProfilePhotoUrl || profilePictureUrl ? (
                <img
                  src={localProfilePhotoUrl || profilePictureUrl}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#94a3b8">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                Profile Picture
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                Upload a professional headshot to make a strong first impression.
              </p>
              {profilePhotoUploadError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>
                  {profilePhotoUploadError}
                </p>
              )}
              {profilePhotoTransformError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>
                  {profilePhotoTransformError}
                </p>
              )}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onUploadProfilePhoto) {
                    onUploadProfilePhoto(file);
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingProfilePhoto || transformingProfilePhoto}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #0A66C2',
                  backgroundColor: uploadingProfilePhoto ? '#cbd5e1' : '#fff',
                  color: uploadingProfilePhoto ? '#64748b' : '#0A66C2',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: uploadingProfilePhoto || transformingProfilePhoto ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 150ms ease',
                }}
              >
                {uploadingProfilePhoto ? 'Uploading…' : 'Upload Photo'}
              </button>
              {localProfilePhotoUrl && onMakeProfilePhotoPresentable && (
                <button
                  type="button"
                  onClick={onMakeProfilePhotoPresentable}
                  disabled={transformingProfilePhoto || uploadingProfilePhoto}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: transformingProfilePhoto
                      ? '#cbd5e1'
                      : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
                    color: transformingProfilePhoto ? '#64748b' : '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: transformingProfilePhoto || uploadingProfilePhoto ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 150ms ease',
                  }}
                >
                  {transformingProfilePhoto ? 'Enhancing…' : '✨ Make Presentable'}
                </button>
              )}
              {localProfilePhotoUrl && onDownloadProfilePhoto && (
                <button
                  type="button"
                  onClick={onDownloadProfilePhoto}
                  disabled={uploadingProfilePhoto || transformingProfilePhoto}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #10b981',
                    backgroundColor: '#fff',
                    color: '#059669',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: uploadingProfilePhoto || transformingProfilePhoto ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 150ms ease',
                  }}
                >
                  ⬇ Download Photo
                </button>
              )}
            </div>
          </div>

          {transformedProfilePhotoUrl && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                backgroundColor: '#ecfdf5',
                border: '1px solid #6ee7b7',
                marginBottom: 16,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#065f46' }}>
                Your enhanced profile photo is ready!
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#047857', lineHeight: 1.5 }}>
                To update your LinkedIn profile: Download the photo above, then go to{' '}
                <strong>LinkedIn → Me → View Profile → Edit profile photo</strong> and upload the downloaded image.
              </p>
            </div>
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
                Improve your LinkedIn profile
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.55 }}>
                {quickWin
                  ? "ALwrity detected opportunities to get more views, connections, and leads — prioritized by impact and time required. Start with 'Quick win'."
                  : 'ALwrity detected opportunities to get more views, connections, and leads — prioritized by impact and time required.'}
              </p>
              {updatedLabel && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  {updatedLabel}
                  {optimizationMeta?.source ? ` ┬╖ Source: ${optimizationMeta.source}` : ''}
                </p>
              )}
              {!updatedLabel && optimizationMeta?.source && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Source: {optimizationMeta.source}
                  {typeof optimizationMeta.remaining_in_backlog === 'number' &&
                    optimizationMeta.remaining_in_backlog > 0 &&
                    ` ┬╖ ${optimizationMeta.remaining_in_backlog} more in backlog`}
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
                  Generating profile suggestionsΓÇª
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
                {isLoadingNextBatch ? 'LoadingΓÇª' : 'Get your next 5 recommendations'}
              </button>
            </div>
          )}

          {showSectionScores && sectionScores && (
            <SectionScoresPanel
              scores={sectionScores}
              activeSectionKeys={activeSectionKeys}
              activeSectionCount={activeSectionCount}
            />
          )}

          {showCards && onRecheckProfile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#475569',
                  lineHeight: 1.4,
                  flex: '1 1 200px',
                }}
              >
                Applied changes on LinkedIn? Re-check your live profile to verify your real score.
              </p>
              <button
                type="button"
                onClick={onRecheckProfile}
                disabled={isRechecking}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid #0A66C2',
                  backgroundColor: isRechecking ? '#cbd5e1' : '#fff',
                  color: isRechecking ? '#64748b' : '#0A66C2',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRechecking ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {isRechecking ? 'Re-checkingΓÇª' : '≡ƒöä Re-check my profile'}
              </button>
            </div>
          )}

          {recheckDelta && onDismissRecheckDelta && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: recheckDelta.current > recheckDelta.previous ? '#ecfdf5' : '#fef3c7',
                border: recheckDelta.current > recheckDelta.previous
                  ? '1px solid #6ee7b7'
                  : '1px solid #fcd34d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: recheckDelta.current > recheckDelta.previous ? '#065f46' : '#92400e',
                  lineHeight: 1.45,
                  flex: 1,
                }}
              >
                {recheckDelta.current > recheckDelta.previous
                  ? `Γ£à Real score improved: ${recheckDelta.previous} ΓåÆ ${recheckDelta.current} (+${
                      recheckDelta.current - recheckDelta.previous
                    } from your live LinkedIn changes).`
                  : recheckDelta.current < recheckDelta.previous
                    ? `Real score changed: ${recheckDelta.previous} ΓåÆ ${recheckDelta.current} (${recheckDelta.current - recheckDelta.previous}). The rubric re-evaluated against your current LinkedIn profile.`
                    : `Score unchanged at ${recheckDelta.current}. The rubric didn't detect new gaps based on your live LinkedIn profile.`}
              </p>
              <button
                type="button"
                onClick={onDismissRecheckDelta}
                aria-label="Dismiss re-check result"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ├ù
              </button>
            </div>
          )}

          {showCards && (
            <div
              id="profile-optimization-list"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {quickWin && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    border: '1px solid #f59e0b',
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 10px',
                      borderRadius: 999,
                      backgroundColor: '#f59e0b',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>⚡</span>
                    Do This First
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        color: '#92400e',
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
                    publicIdentifier={publicIdentifier}
                    showEffortTimeLabel={formatEffortTimeLabel(quickWin.effort)}
                  />
                </div>
              )}

              {remainingItems.map((item, index) => (
                <ProfileOptimizationCard
                  key={item.id}
                  recommendation={item}
                  index={quickWin ? index + 1 : index}
                  onMarkDone={onMarkDone}
                  onSkip={onSkip}
                  isMarking={markingRecommendationId === item.id}
                  publicIdentifier={publicIdentifier}
                  showEffortTimeLabel={formatEffortTimeLabel(item.effort)}
                />
              ))}
            </div>
          )}

          {showCards && writingOpportunities.length > 0 && (
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
                      Your experience in {contentBridgeIndustry}
                      {contentBridgeExpertise && (
                        <> and expertise in <strong>{contentBridgeExpertise}</strong></>
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
                  {visibleOpportunities.map((opportunity, idx) => (
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

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAngles((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #c4b5fd',
                      backgroundColor: '#fff',
                      color: '#6b21a8',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: 12,
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3e8ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                    }}
                  >
                    {showAllAngles ? (
                      <>Show fewer angles ▲</>
                    ) : (
                      <>Show {hiddenCount} more angle{hiddenCount !== 1 ? 's' : ''} ▼</>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
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
    </>
  );
};
