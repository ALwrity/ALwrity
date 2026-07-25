import React, { useRef } from "react";
import { CircularProgress, Tooltip } from "@mui/material";

import type {
  LinkedInAIProfileIntelligence,
  LinkedInProfileOptimizationItem,
  LinkedInProfileOptimizationMeta,
} from "../../../../api/linkedinSocial";
import { linkedInPlaceholderCardStyles } from "../linkedInPlaceholderStyles";
import { formatRelativeUpdatedAt } from "../TopicRecommendations/topicRecommendationLabels";
import { BrandIdentityCard } from "./BrandIdentityCard";
import { ProfileOptimizationCard } from "./ProfileOptimizationCard";
import { ProfileOptimizationSummaryBar } from "./ProfileOptimizationSummaryBar";
import { SectionScoresPanel } from "./SectionScoresPanel";
import {
  ProfileOptimizationBatchBanner,
  ProfileOptimizationNoGapsState,
  ProfileOptimizationRecheckBadge,
} from "./ProfileOptimizationTerminalStates";
import { ProfileOptimizationContentAnglesCard } from "./ProfileOptimizationContentAnglesCard";
import { ProfileOptimizationBatchImpactBar } from "./ProfileOptimizationBatchImpactBar";
import { computeBatchImpactProjection } from "./profileOptimizationImpact";
import { resolveContentAnglesForDisplay } from "./profileOptimizationContentAngles";

interface ProfileOptimizationPanelProps {
  isOpen: boolean;
  /** When modal, chrome (header/footer) is supplied by the dialog wrapper. */
  variant?: "standalone" | "modal";
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
  padding: "16px 18px",
  borderRadius: 12,
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  minHeight: 120,
};

const SKELETON_COUNT = 3;

const panelBackgroundGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: "-50%",
  left: "-50%",
  width: "200%",
  height: "200%",
  background:
    "radial-gradient(circle, rgba(10, 102, 194, 0.06) 0%, transparent 70%)",
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
  items: LinkedInProfileOptimizationItem[],
): LinkedInProfileOptimizationItem | null {
  return (
    items.find((item) => item.impact === "High" && item.effort === "Low") ??
    items.find((item) => item.impact === "High" && item.effort === "Medium") ??
    items.find((item) => item.impact === "Medium" && item.effort === "Low") ??
    null
  );
}

function formatEffortTimeLabel(effort: string): string {
  switch (effort) {
    case "Low":
      return "Takes ~5 minutes";
    case "Medium":
      return "Takes ~20 minutes";
    case "High":
      return "Takes an afternoon";
    default:
      return "";
  }
}

/** Phase 7 ΓÇö profile optimization recommendations panel. */
export const ProfileOptimizationPanel: React.FC<
  ProfileOptimizationPanelProps
> = ({
  isOpen,
  variant = "standalone",
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
      (a, b) => computePriorityScore(a) - computePriorityScore(b),
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

  const quickWinsLabel =
    sortedRecommendations.length > 0
      ? `${sortedRecommendations.length} Quick Win${sortedRecommendations.length === 1 ? "" : "s"}`
      : "Review your profile";
  const batchIndex = (optimizationMeta?.active_batch_index ?? 0) + 1;
  const batchNumberLabel = `Batch ${batchIndex}`;
  const batchProjection = computeBatchImpactProjection(
    profileStrengthPercent,
    sortedRecommendations,
  );

  const [showAllAngles, setShowAllAngles] = React.useState(false);
  const [showAllRecommendations, setShowAllRecommendations] =
    React.useState(false);
  const VISIBLE_ANGLES_COUNT = 3;
  const VISIBLE_REC_COUNT = 3;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayContentAngles = React.useMemo(
    () =>
      resolveContentAnglesForDisplay(
        aiProfileIntelligence?.writing_opportunities ?? [],
        aiProfileIntelligence?.knowledge_domains,
        aiProfileIntelligence?.primary_expertise,
        aiProfileIntelligence?.target_audience,
      ),
    [
      aiProfileIntelligence?.writing_opportunities,
      aiProfileIntelligence?.knowledge_domains,
      aiProfileIntelligence?.primary_expertise,
      aiProfileIntelligence?.target_audience,
    ],
  );
  const contentBridgeIndustry =
    aiProfileIntelligence?.industry &&
    aiProfileIntelligence.industry !== "Unknown"
      ? aiProfileIntelligence.industry
      : "your industry";
  const contentBridgeExpertise = aiProfileIntelligence?.primary_expertise?.[0];
  const isModal = variant === "modal";

  const { showSkeleton, showCards } = React.useMemo(() => {
    const skeleton = Boolean(isLoading && !recommendations?.length);
    return {
      showSkeleton: skeleton,
      showCards: !skeleton && Boolean(recommendations?.length),
    };
  }, [isLoading, recommendations?.length]);

  const strengthHoverMessage =
    profileStrengthPercent != null
      ? `Your profile currently communicates ${profileStrengthPercent}% of this positioning — here's how to strengthen it.`
      : null;

  React.useEffect(() => {
    setShowAllRecommendations(false);
  }, [recommendations]);

  if (!isOpen) {
    return null;
  }

  const updatedLabel = formatRelativeUpdatedAt(
    optimizationMeta?.profile_optimization_updated_at,
  );
  const recommendationCount = recommendations?.length ?? 0;
  const collapsedVisibleCount =
    (quickWin ? 1 : 0) + Math.min(remainingItems.length, VISIBLE_REC_COUNT);

  const visibleRemainingItems = isModal
    ? remainingItems
    : showAllRecommendations
      ? remainingItems
      : remainingItems.slice(0, VISIBLE_REC_COUNT);
  const canToggleAllSuggestions =
    !isModal && recommendationCount > collapsedVisibleCount;
  const showNoGaps = !showSkeleton && !showCards && Boolean(noGapsMessage);
  const showNextBatchBanner =
    !showSkeleton &&
    !showCards &&
    !showNoGaps &&
    showNextBatchCta &&
    Boolean(onLoadNextBatch);
  const showEmptyPrompt = !showSkeleton && !showCards && !showNoGaps && !showNextBatchBanner;

  const showSectionScores =
    Boolean(sectionScores) && (showCards || showNextBatchBanner);

  if (!isExpanded && (showCards || showNextBatchBanner) && onExpand) {
    return (
      <div style={{ ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }}>
        <div
          style={{
            ...linkedInPlaceholderCardStyles.inner,
            minHeight: "unset",
            padding: "16px 20px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={panelBackgroundGlowStyle} />
          <div style={{ position: "relative", zIndex: 1 }}>
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
      <div
        className={["profile-opt-panel", isModal && "profile-opt-panel--modal"]
          .filter(Boolean)
          .join(" ")}
        style={
          isModal
            ? undefined
            : { ...linkedInPlaceholderCardStyles.wrapper, marginTop: 16 }
        }
      >
        <div
          className={[
            "profile-opt-panel__inner",
            isModal && "profile-opt-panel__inner--modal",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            isModal ? undefined : { ...linkedInPlaceholderCardStyles.inner }
          }
        >
          {!isModal && <div style={panelBackgroundGlowStyle} />}

          <div
            className={isModal ? "profile-opt-panel__modal-shell" : undefined}
            style={isModal ? undefined : { position: "relative", zIndex: 1 }}
          >
            {!isModal && (
              <div className="profile-opt-panel__header">
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <h3 className="profile-opt-panel__title">
                    Improve your LinkedIn profile
                  </h3>
                  <p className="profile-opt-panel__subtitle">
                    {quickWin
                      ? "Prioritized by impact — start with your quick win below."
                      : "Get more views, connections, and leads with prioritized suggestions."}
                  </p>
                  {updatedLabel && (
                    <p className="profile-opt-panel__meta">
                      {updatedLabel}
                      {optimizationMeta?.source
                        ? ` · ${optimizationMeta.source}`
                        : ""}
                      {optimizationMeta?.completed_ids_count != null &&
                       optimizationMeta.completed_ids_count > 0
                        ? ` · ${optimizationMeta.completed_ids_count} completed`
                        : ""}
                      <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        style={{
                          marginLeft: 10,
                          background: "none",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          padding: "1px 8px",
                          fontSize: 11,
                          color: isLoading ? "#94a3b8" : "#64748b",
                          cursor: isLoading ? "default" : "pointer",
                        }}
                      >
                        ↻ Refresh
                      </button>
                    </p>
                  )}
                  {!updatedLabel && optimizationMeta?.source && (
                    <p className="profile-opt-panel__meta">
                      Source: {optimizationMeta.source}
                      {typeof optimizationMeta.remaining_in_backlog ===
                        "number" &&
                        optimizationMeta.remaining_in_backlog > 0 &&
                        ` · ${optimizationMeta.remaining_in_backlog} more in backlog`}
                    </p>
                  )}
                </div>

                {showCards && onCollapse && (
                  <button
                    type="button"
                    className="profile-opt-panel__hide-link"
                    onClick={onCollapse}
                    aria-expanded
                    aria-controls="profile-optimization-list"
                  >
                    Hide suggestions
                  </button>
                )}
              </div>
            )}

            {!isModal && (
              <>
                {/* Profile Photo Card */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                    borderRadius: 12,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      backgroundColor: "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {localProfilePhotoUrl || profilePictureUrl ? (
                      <img
                        src={
                          (localProfilePhotoUrl || profilePictureUrl) ??
                          undefined
                        }
                        alt="Profile"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="#94a3b8"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      Profile Picture
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 12,
                        color: "#64748b",
                        lineHeight: 1.4,
                      }}
                    >
                      {localProfilePhotoUrl || profilePictureUrl
                        ? "Use AI to enhance your photo into a professional headshot."
                        : "Upload a photo to enhance it with AI into a professional headshot."}
                    </p>
                    {profilePhotoUploadError && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#dc2626",
                        }}
                      >
                        {profilePhotoUploadError}
                      </p>
                    )}
                    {profilePhotoTransformError && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: "#dc2626",
                        }}
                      >
                        {profilePhotoTransformError}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      alignItems: "flex-end",
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onUploadProfilePhoto) {
                          onUploadProfilePhoto(file);
                        }
                        e.target.value = "";
                      }}
                    />

                    {/* Upload — always available as secondary action */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        uploadingProfilePhoto || transformingProfilePhoto
                      }
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        backgroundColor: uploadingProfilePhoto
                          ? "#f1f5f9"
                          : "#fff",
                        color: uploadingProfilePhoto ? "#94a3b8" : "#64748b",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor:
                          uploadingProfilePhoto || transformingProfilePhoto
                            ? "wait"
                            : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {uploadingProfilePhoto ? "Uploading…" : "📷 Upload"}
                    </button>

                    {/* Make Presentable — show when any photo exists (existing or uploaded) */}
                    {(localProfilePhotoUrl || profilePictureUrl) &&
                      onMakeProfilePhotoPresentable && (
                        <button
                          type="button"
                          onClick={onMakeProfilePhotoPresentable}
                          disabled={
                            transformingProfilePhoto || uploadingProfilePhoto
                          }
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border: "none",
                            background: transformingProfilePhoto
                              ? "#cbd5e1"
                              : "linear-gradient(135deg, #0A66C2 0%, #004182 100%)",
                            color: transformingProfilePhoto ? "#64748b" : "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor:
                              transformingProfilePhoto || uploadingProfilePhoto
                                ? "wait"
                                : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {transformingProfilePhoto
                            ? "Enhancing…"
                            : "✨ Make Presentable"}
                        </button>
                      )}

                    {/* Download transformed photo */}
                    {transformedProfilePhotoUrl && onDownloadProfilePhoto && (
                      <button
                        type="button"
                        onClick={onDownloadProfilePhoto}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: "1px solid #059669",
                          background: "#ecfdf5",
                          color: "#059669",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ⬇ Download
                      </button>
                    )}
                  </div>
                </div>

                {transformedProfilePhotoUrl && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      backgroundColor: "#ecfdf5",
                      border: "1px solid #6ee7b7",
                      marginBottom: 16,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#065f46",
                      }}
                    >
                      Your enhanced profile photo is ready!
                    </p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#047857",
                        lineHeight: 1.5,
                      }}
                    >
                      To update your LinkedIn profile: Download the photo above,
                      then go to{" "}
                      <strong>
                        LinkedIn → Me → View Profile → Edit profile photo
                      </strong>{" "}
                      and upload the downloaded image.
                    </p>
                  </div>
                )}
              </>
            )}

            <div
              className={[
                "profile-opt-panel__grid",
                isModal && "profile-opt-panel__grid--modal",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <aside className="profile-opt-panel__rail">
                <div className="profile-opt-panel__rail-inner">
                  {aiProfileIntelligence && (
                    <BrandIdentityCard
                      intelligence={aiProfileIntelligence}
                      profileStrengthPercent={profileStrengthPercent}
                      showStrengthMessage={!isModal}
                      className={
                        isModal
                          ? "profile-opt-brand-identity-card--modal"
                          : undefined
                      }
                    />
                  )}

                  {showSectionScores && sectionScores && !isModal && (
                    <SectionScoresPanel
                      scores={sectionScores}
                      activeSectionKeys={activeSectionKeys}
                      activeSectionCount={activeSectionCount}
                    />
                  )}

                  {((showCards && displayContentAngles.length > 0) ||
                    (isModal && displayContentAngles.length > 0)) && (
                    <ProfileOptimizationContentAnglesCard
                      industry={contentBridgeIndustry}
                      expertise={contentBridgeExpertise}
                      opportunities={displayContentAngles}
                      showAllAngles={isModal || showAllAngles}
                      onToggleShowAllAngles={() =>
                        setShowAllAngles((value) => !value)
                      }
                      visibleCount={
                        isModal
                          ? displayContentAngles.length
                          : VISIBLE_ANGLES_COUNT
                      }
                      alwaysExpanded={isModal}
                    />
                  )}

                  {showCards && onRecheckProfile && !isModal && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        flexWrap: "wrap",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#475569",
                          lineHeight: 1.4,
                          flex: "1 1 200px",
                        }}
                      >
                        Applied changes on LinkedIn? Re-check your live profile
                        to verify your real score.
                      </p>
                      <button
                        type="button"
                        onClick={onRecheckProfile}
                        disabled={isRechecking}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #0A66C2",
                          backgroundColor: isRechecking ? "#cbd5e1" : "#fff",
                          color: isRechecking ? "#64748b" : "#0A66C2",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isRechecking ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isRechecking
                          ? "Re-checking…"
                          : "🔄 Re-check my profile"}
                      </button>
                    </div>
                  )}

                  {recheckDelta && onDismissRecheckDelta && !isModal && (
                    <ProfileOptimizationRecheckBadge
                      recheckDelta={recheckDelta}
                      onDismiss={onDismissRecheckDelta}
                    />
                  )}
                </div>
              </aside>

              <div className="profile-opt-panel__main">
                {showSkeleton && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: "#64748b",
                          fontSize: 14,
                          marginBottom: 4,
                        }}
                      >
                        <CircularProgress size={20} sx={{ color: "#0A66C2" }} />
                        Analyzing your profile…
                      </div>
                      <StepIndicator
                        steps={[
                          "Reading your LinkedIn profile",
                          "Analyzing profile strengths & gaps",
                          "Generating personalized recommendations",
                          "Finalizing your optimization plan",
                        ]}
                      />
                      {Array.from({ length: SKELETON_COUNT }).map(
                        (_, index) => (
                          <div
                            key={index}
                            className="profile-opt-panel__shimmer"
                            style={SKELETON_CARD_STYLE}
                            aria-hidden
                          />
                        ),
                      )}
                    </div>
                  </>
                )}

                {showNoGaps && (
                  <ProfileOptimizationNoGapsState
                    message={noGapsMessage}
                    onClose={onCollapse}
                  />
                )}

                {showEmptyPrompt && (
                  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>
                      No recommendations yet
                    </p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                      Click Refresh to analyze your profile and generate
                      personalized optimization suggestions.
                    </p>
                    <button
                      type="button"
                      onClick={onRefresh}
                      disabled={isLoading}
                      style={{
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: isLoading ? '#94a3b8' : '#0a66c2',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isLoading ? 'default' : 'pointer',
                      }}
                    >
                      {isLoading ? 'Analyzing…' : 'Generate Recommendations'}
                    </button>
                  </div>
                )}

                {showNextBatchBanner && (
                  <ProfileOptimizationBatchBanner
                    remainingInBacklog={
                      optimizationMeta?.remaining_in_backlog ?? 0
                    }
                    isLoadingNextBatch={isLoadingNextBatch}
                    onLoadNextBatch={onLoadNextBatch}
                    hideInlineAction={isModal}
                  />
                )}

                {showCards && isModal && (
                  <Tooltip
                    title={strengthHoverMessage ?? ""}
                    arrow
                    placement="left"
                    enterDelay={280}
                    disableHoverListener={!strengthHoverMessage}
                    slotProps={{
                      tooltip: {
                        sx: {
                          maxWidth: 300,
                          fontSize: 13,
                          lineHeight: 1.5,
                          fontWeight: 500,
                        },
                      },
                    }}
                  >
                    <div
                      id="profile-optimization-list"
                      className="profile-opt-panel__suggestions-stack profile-opt-panel__suggestions-stack--modal profile-opt-panel__suggestions-stack--hover-tip"
                    >
                      <div className="profile-opt-panel__suggestions-stack-header">
                        <h3
                          id="profile-opt-batch-stack-title"
                          className="profile-opt-panel__suggestions-stack-title"
                        >
                          {profileStrengthPercent != null
                            ? `Your profile currently communicates ${profileStrengthPercent}% of this positioning — here's how to strengthen it.`
                            : quickWinsLabel}
                        </h3>
                      </div>
                      <div className="profile-opt-panel__suggestions-stack-inner">
                        <div className="profile-opt-panel__suggestions-cards">
                          <ProfileOptimizationBatchImpactBar
                            stackCard
                            hideSessionLabel
                            batchLabel={batchNumberLabel}
                            batchGainHint={
                              batchProjection.gainPoints > 0
                                ? `+${batchProjection.gainPoints}% profile strength if you apply this batch`
                                : undefined
                            }
                            recommendations={sortedRecommendations}
                            optimizationMeta={optimizationMeta}
                            profileStrengthPercent={profileStrengthPercent}
                            sectionScores={sectionScores ?? null}
                            activeSectionKeys={activeSectionKeys}
                            activeSectionCount={activeSectionCount}
                          />
                          {sortedRecommendations.map((item, index) => (
                            <ProfileOptimizationCard
                              key={item.id}
                              recommendation={item}
                              index={index}
                              onMarkDone={onMarkDone}
                              onSkip={onSkip}
                              isMarking={markingRecommendationId === item.id}
                              publicIdentifier={publicIdentifier}
                              showEffortTimeLabel={formatEffortTimeLabel(
                                item.effort,
                              )}
                              promotePrimaryActions={quickWin?.id === item.id}
                              className={[
                                "profile-opt-card--stack",
                                index === 0 && "profile-opt-card--first",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                )}

                {showCards && !isModal && (
                  <div
                    id="profile-optimization-list"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {quickWin && (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                          border: "1px solid #f59e0b",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "5px 10px",
                            borderRadius: 999,
                            backgroundColor: "#f59e0b",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>⚡</span>
                          Do This First
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              backgroundColor: "rgba(255,255,255,0.92)",
                              color: "#92400e",
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
                          showEffortTimeLabel={formatEffortTimeLabel(
                            quickWin.effort,
                          )}
                          promotePrimaryActions
                        />
                      </div>
                    )}

                    {visibleRemainingItems.map((item, index) => (
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

                    {canToggleAllSuggestions && (
                      <button
                        type="button"
                        className={[
                          "profile-opt-panel__show-all",
                          isModal && "profile-opt-panel__show-all--modal",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() =>
                          setShowAllRecommendations((value) => !value)
                        }
                        aria-expanded={showAllRecommendations}
                      >
                        {showAllRecommendations
                          ? "Show fewer suggestions"
                          : `Show all (${recommendationCount} suggestion${recommendationCount === 1 ? "" : "s"})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Progress step indicator ──

const StepIndicator: React.FC<{ steps: string[] }> = ({ steps }) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
      {steps.map((label, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: i <= step ? "#0A66C2" : "#d1d5db",
            fontWeight: i <= step ? 600 : 400,
            transition: "color 0.4s",
          }}
        >
          <span style={{ width: 16, textAlign: "center" }}>
            {i < step ? "✓" : i === step ? "●" : "○"}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
};
