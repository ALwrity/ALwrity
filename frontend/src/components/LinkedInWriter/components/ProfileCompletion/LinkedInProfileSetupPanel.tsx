import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLinkedInProfileCompletion } from "../../../../hooks/useLinkedInProfileCompletion";
import { useLinkedInProfileOptimization } from "../../../../hooks/useLinkedInProfileOptimization";
import { LinkedInConnectedProfileCard } from "../LinkedInConnectedProfileCard";
import { LinkedInProfileHubStrip } from "../LinkedInProfileHubStrip";
import { TopicRecommendationsPanel } from "../TopicRecommendations/TopicRecommendationsPanel";
import { AnalysisErrorAlert } from "../TopicRecommendations/TopicSuggestionIntro";
import { LinkedInAdvisorActionsBar } from "../ProfileOptimization/LinkedInAdvisorActionsBar";
import { ProfileOptimizationPanel } from "../ProfileOptimization/ProfileOptimizationPanel";
import {
  ProfileOptimizationModalHeader,
} from "../ProfileOptimization/ProfileOptimizationModalChrome";
import { TransformedPhotoPreview } from "../ProfileOptimization/TransformedPhotoPreview";
import { ProfileCompletionForm } from "./ProfileCompletionForm";
import { ProfileCompletionQuestionsModal } from "./ProfileCompletionQuestionsModal";
import {
  ProfileAnalysisReadyModal,
  buildProfileActionPoints,
} from "../dashboard/ProfileAnalysisReadyModal";
import {
  getDisplayProfileStrengthPercent,
  getProfileStrengthDisplayLabel,
  getProfileStrengthTooltip,
} from "../../utils/profileStrengthUtils";
import { DashboardErrorModal } from "../dashboard/DashboardErrorModal";
import { DashboardActionModal } from "../dashboard/DashboardActionModal";
import { buildDashboardErrorConfig } from "../dashboard/dashboardErrorConfig";
import { useModalFocusTrap } from "../../hooks/useModalFocusTrap";
import {
  openWorkflowWedge,
  type QuickCreateReturnTarget,
} from "../dashboard/workflowWedgeNavigation";
import {
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
} from "../dashboard/wedgeModalUi";
import { POST_WEDGE_MODAL_SIZE } from "../dashboard/wedgeModalLayout";

const ANALYSIS_MODAL_DISMISSED_KEY =
  "linkedin_profile_analysis_modal_dismissed_v2";

/** Check if the analysis-ready modal was dismissed (persists across sessions). */
function isDismissalValid(): boolean {
  try {
    const raw = localStorage.getItem(ANALYSIS_MODAL_DISMISSED_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as {
      permanent?: boolean;
      expires?: number;
    };
    if (data.permanent) return true;
    if (data.expires && Date.now() < data.expires) return true;
    return false;
  } catch {
    return false;
  }
}

/** Store permanent dismissal so the modal shows at most once per user. */
function storeDismissal(): void {
  try {
    localStorage.setItem(
      ANALYSIS_MODAL_DISMISSED_KEY,
      JSON.stringify({
        permanent: true,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // localStorage may be unavailable in private mode
  }
}

interface LinkedInProfileSetupPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
  centered?: boolean;
  hideDisconnectButton?: boolean;
  /** Mobile hero: compact profile strip with inline connect/disconnect. */
  mobileProfileStrip?: boolean;
  /** When true, defer blocking profile error modal (connect welcome / studio tour). */
  blockDashboardErrorModal?: boolean;
}

export const LinkedInProfileSetupPanel: React.FC<
  LinkedInProfileSetupPanelProps
> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
  centered = false,
  hideDisconnectButton = false,
  mobileProfileStrip = false,
  blockDashboardErrorModal = false,
}) => {
  const {
    foundationStatus,
    foundationError,
    topicState,
    topicError,
    isAnalyzing,
    questions,
    isSubmitting,
    submitError,
    recommendations,
    recommendationsMeta,
    recommendationsError,
    isRecommendationsExpanded,
    collapseRecommendations,
    expandRecommendations,
    isProfileComplete,
    profile,
    profileValidation,
    aiProfileIntelligence,
    loadFoundation,
    runTopicAnalysis,
    submitCompletion,
    applyProfileRefreshResponse,
  } = useLinkedInProfileCompletion();

  const publicIdentifier =
    typeof profile?.public_identifier === "string"
      ? profile.public_identifier
      : null;

  const {
    optimizationPanelState,
    isOptimizationOpen,
    isOptimizationLoading,
    isOptimizationDisabled,
    recommendations: optimizationRecommendations,
    optimizationMeta,
    optimizationError,
    optimizationUserError,
    isOptimizationExpanded,
    openOptimizationPanel,
    closeOptimizationPanel,
    collapseOptimization,
    expandOptimization,
    retryOptimization,
    refreshOptimization,
    recheckProfile,
    recheckDelta,
    dismissRecheckDelta,
    isRechecking,
    markOptimizationItemComplete,
    loadNextOptimizationBatch,
    markingRecommendationId,
    isLoadingNextBatch,
    showNextBatchCta,
    localProfilePhotoUrl,
    uploadingProfilePhoto,
    profilePhotoUploadError,
    handleUploadProfilePhoto,
    transformedProfilePhotoUrl,
    transformingProfilePhoto,
    profilePhotoTransformError,
    handleMakeProfilePhotoPresentable,
    handleDownloadProfilePhoto,
    showTransformedPreview,
    dismissTransformedPreview,
  } = useLinkedInProfileOptimization(isProfileComplete);

  const handleRecheckProfile = useCallback(async () => {
    const data = await recheckProfile();
    if (data) {
      applyProfileRefreshResponse(data);
    }
  }, [recheckProfile, applyProfileRefreshResponse]);

  const handleGetTopicIdeas = () => {
    setIsTopicPanelOpen(true);
    void runTopicAnalysis(false);
  };

  const handleRetryTopic = () => {
    setIsTopicPanelOpen(true);
    void runTopicAnalysis(false);
  };

  const handleRefreshRecommendations = () => {
    setIsTopicPanelOpen(true);
    void runTopicAnalysis(true);
  };

  const handleRetryFoundation = () => {
    void loadFoundation();
  };

  const showAdvisorBar =
    !centered &&
    (foundationStatus === "loading" ||
      foundationStatus === "ready" ||
      foundationStatus === "needs_completion" ||
      (foundationStatus === "error" && !questions.length));

  const profileStrengthPercent =
    getDisplayProfileStrengthPercent(profileValidation);
  const strengthLabel = getProfileStrengthDisplayLabel(
    profileValidation,
    profileStrengthPercent,
  );
  const strengthTooltip = getProfileStrengthTooltip(profileValidation);

  const actionPoints = useMemo(
    () =>
      buildProfileActionPoints(
        profileValidation?.missing_fields,
        profileValidation?.optional_missing_fields,
        aiProfileIntelligence?.writing_opportunities,
        profileValidation?.optimization_gaps_count,
      ),
    [profileValidation, aiProfileIntelligence],
  );

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisModalDismissed, setAnalysisModalDismissed] = useState(() =>
    isDismissalValid(),
  );
  const [isTopicPanelOpen, setIsTopicPanelOpen] = useState(false);
  const [topicReturnTo, setTopicReturnTo] = useState<QuickCreateReturnTarget | null>(
    null,
  );
  const optimizationDialogRef = useRef<HTMLDivElement>(null);

  useModalFocusTrap(optimizationDialogRef, centered && isOptimizationOpen, () =>
    closeOptimizationPanel(),
  );

  /** Phase 4 — skip the ready modal when analysis/optimisation data already exists or was dismissed. */
  const skipAnalysisReadyModal = useMemo(() => {
    if (analysisModalDismissed) return true;
    if (optimizationRecommendations && optimizationRecommendations.length > 0)
      return true;
    const source = optimizationMeta?.source;
    if (
      source === "cache" ||
      source === "generated" ||
      source === "no_gaps" ||
      source === "batch_advanced"
    ) {
      return true;
    }
    if (optimizationMeta?.profile_optimization_updated_at) return true;
    return false;
  }, [analysisModalDismissed, optimizationRecommendations, optimizationMeta]);

  const markAnalysisModalDismissed = useCallback(() => {
    storeDismissal();
    setAnalysisModalDismissed(true);
    setShowAnalysisModal(false);
  }, []);

  const handleImproveProfile = () => {
    markAnalysisModalDismissed();
    void openOptimizationPanel();
  };

  useEffect(() => {
    if (!centered || !isOptimizationOpen) return;
    document.body.classList.add("linkedin-profile-optimization-open");
    return () => {
      document.body.classList.remove("linkedin-profile-optimization-open");
    };
  }, [centered, isOptimizationOpen]);

  /** Keep header + left-rail boxes visible — reset scroll when the modal opens or content loads. */
  useEffect(() => {
    if (!centered || !isOptimizationOpen) return;

    const resetModalScroll = () => {
      const dialog = optimizationDialogRef.current;
      const overlay = dialog?.parentElement;
      overlay?.scrollTo({ top: 0, left: 0 });
      dialog
        ?.querySelector<HTMLElement>(
          ".linkedin-profile-optimization-dialog__body",
        )
        ?.scrollTo({ top: 0, left: 0 });
    };

    resetModalScroll();
    const rafId = requestAnimationFrame(resetModalScroll);
    const timeoutId = window.setTimeout(resetModalScroll, 120);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [centered, isOptimizationOpen, optimizationRecommendations?.length]);
  const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(
    null,
  );

  // TC-007: Auto-show analysis modal when profile data is ready and not recently dismissed
  useEffect(() => {
    if (
      centered &&
      foundationStatus === "ready" &&
      profileValidation &&
      !skipAnalysisReadyModal
    ) {
      setShowAnalysisModal(true);
    }
  }, [centered, foundationStatus, profileValidation, skipAnalysisReadyModal]);

  useEffect(() => {
    if (skipAnalysisReadyModal && showAnalysisModal) {
      setShowAnalysisModal(false);
    }
  }, [skipAnalysisReadyModal, showAnalysisModal]);

  const closeTopicPanel = () => {
    setIsTopicPanelOpen(false);
    setTopicReturnTo(null);
    collapseRecommendations();
  };

  const handleTopicBack = () => {
    const target = topicReturnTo;
    closeTopicPanel();
    if (target) {
      openWorkflowWedge({ wedge: target.wedge, sub: target.sub });
    }
  };

  const showTopicModal =
    centered &&
    isTopicPanelOpen &&
    (topicState === "running" || topicState === "complete");

  const dashboardErrorConfig = useMemo(
    () =>
      buildDashboardErrorConfig({
        centered,
        foundationStatus,
        foundationError,
        optimizationPanelState,
        optimizationError,
        optimizationUserError,
        topicState,
        topicError,
        submitError,
        recommendationsError,
        onRetryFoundation: handleRetryFoundation,
        onRetryOptimization: () => {
          void retryOptimization();
        },
        onRetryTopic: handleRetryTopic,
        isOptimizationLoading,
        isAnalyzing,
      }),
    [
      centered,
      foundationStatus,
      foundationError,
      optimizationPanelState,
      optimizationError,
      optimizationUserError,
      topicState,
      topicError,
      submitError,
      recommendationsError,
      isOptimizationLoading,
      isAnalyzing,
    ],
  );

  useEffect(() => {
    if (isOptimizationLoading || isAnalyzing) {
      setDismissedErrorKey(null);
    }
  }, [isOptimizationLoading, isAnalyzing]);

  const showDashboardErrorModal = Boolean(
    centered &&
    dashboardErrorConfig &&
    dismissedErrorKey !== dashboardErrorConfig.key &&
    !blockDashboardErrorModal,
  );

  useEffect(() => {
    if (topicState === "error") {
      setIsTopicPanelOpen(false);
    }
  }, [topicState]);

  useEffect(() => {
    const onGetTopicIdeas = (event: Event) => {
      const detail = (event as CustomEvent<{ returnTo?: QuickCreateReturnTarget }>)
        .detail;
      setTopicReturnTo(detail?.returnTo ?? null);
      setIsTopicPanelOpen(true);
      void runTopicAnalysis(false);
    };
    const onOpenOptimise = () => {
      markAnalysisModalDismissed();
      void openOptimizationPanel();
    };
    const onOpenQuickCreate = () => {
      setIsTopicPanelOpen(false);
      collapseRecommendations();
    };
    window.addEventListener("linkedinwriter:getTopicIdeas", onGetTopicIdeas);
    window.addEventListener(
      "linkedinwriter:openOptimiseProfile",
      onOpenOptimise,
    );
    window.addEventListener(
      "linkedinwriter:openQuickCreate",
      onOpenQuickCreate,
    );
    return () => {
      window.removeEventListener(
        "linkedinwriter:getTopicIdeas",
        onGetTopicIdeas,
      );
      window.removeEventListener(
        "linkedinwriter:openOptimiseProfile",
        onOpenOptimise,
      );
      window.removeEventListener(
        "linkedinwriter:openQuickCreate",
        onOpenQuickCreate,
      );
    };
  }, [
    runTopicAnalysis,
    openOptimizationPanel,
    collapseRecommendations,
    markAnalysisModalDismissed,
  ]);

  const dismissAnalysisModal = () => {
    markAnalysisModalDismissed();
  };

  const handleOptimiseFromModal = () => {
    markAnalysisModalDismissed();
    void openOptimizationPanel();
  };

  return (
    <div style={{ width: "100%", maxWidth: centered ? undefined : 1200 }}>
      <ProfileAnalysisReadyModal
        open={showAnalysisModal}
        profileStrengthPercent={profileStrengthPercent ?? 0}
        strengthLabel={strengthLabel}
        strengthTooltip={strengthTooltip}
        isProfileComplete={profileValidation?.is_profile_complete ?? false}
        actionPoints={actionPoints}
        onOptimiseProfile={handleOptimiseFromModal}
        onDismiss={dismissAnalysisModal}
        isOptimiseDisabled={isOptimizationDisabled}
      />

      {dashboardErrorConfig && (
        <DashboardErrorModal
          open={showDashboardErrorModal}
          error={dashboardErrorConfig.error}
          title={dashboardErrorConfig.title}
          onRetry={dashboardErrorConfig.onRetry}
          isRetrying={dashboardErrorConfig.isRetrying}
          onDismiss={() => setDismissedErrorKey(dashboardErrorConfig.key)}
        />
      )}

      {mobileProfileStrip ? (
        <LinkedInProfileHubStrip
          connected
          displayName={displayName}
          avatarUrl={avatarUrl}
          isDisconnecting={isDisconnecting}
          onDisconnect={onDisconnect}
        />
      ) : (
        <LinkedInConnectedProfileCard
          displayName={displayName}
          avatarUrl={avatarUrl}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
          disconnectError={disconnectError}
          centered={centered}
          onOptimiseProfile={centered ? handleImproveProfile : undefined}
          profileStrengthPercent={centered ? profileStrengthPercent : null}
          strengthLabel={centered ? strengthLabel : undefined}
          strengthTooltip={centered ? strengthTooltip : undefined}
          isOptimiseDisabled={
            isOptimizationDisabled || foundationStatus !== "ready"
          }
          isOptimiseLoading={isOptimizationLoading}
          hideDisconnectButton={hideDisconnectButton}
        />
      )}

      {showAdvisorBar && (
        <LinkedInAdvisorActionsBar
          foundationStatus={foundationStatus}
          isTopicRunning={isAnalyzing}
          isOptimizationRunning={isOptimizationLoading}
          isOptimizationDisabled={isOptimizationDisabled}
          onImproveProfile={handleImproveProfile}
          onGetTopicIdeas={handleGetTopicIdeas}
        />
      )}

      {!centered && foundationStatus === "error" && foundationError && (
        <AnalysisErrorAlert
          error={foundationError}
          onRetry={handleRetryFoundation}
        />
      )}

      {centered ? (
        isOptimizationOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="linkedin-profile-optimization-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Profile optimization suggestions"
            onClick={() => closeOptimizationPanel()}
          >
            <div
              ref={optimizationDialogRef}
              className="linkedin-profile-optimization-dialog"
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="profile-optimization-dialog-title"
            >
              <ProfileOptimizationModalHeader
                profileStrengthPercent={profileStrengthPercent}
                strengthLabel={strengthLabel}
                strengthTooltip={strengthTooltip}
                isRechecking={isRechecking}
                recheckDelta={recheckDelta}
                onRecheckProfile={() => {
                  void handleRecheckProfile();
                }}
                onDismissRecheckDelta={dismissRecheckDelta}
                onClose={() => closeOptimizationPanel()}
                displayName={displayName}
                profilePictureUrl={avatarUrl}
                localProfilePhotoUrl={localProfilePhotoUrl}
                profilePhotoUploadError={profilePhotoUploadError}
              />
              <div className="linkedin-profile-optimization-dialog__body linkedin-profile-optimization-dialog__body--modal-layout">
                <ProfileOptimizationPanel
                  variant="modal"
                  isOpen={isOptimizationOpen}
                  isLoading={isOptimizationLoading}
                  recommendations={optimizationRecommendations}
                  optimizationMeta={optimizationMeta}
                  noGapsMessage={
                    optimizationMeta?.source === "no_gaps"
                      ? (optimizationMeta.message ?? null)
                      : null
                  }
                  isExpanded={isOptimizationExpanded}
                  isRefreshing={isOptimizationLoading}
                  showNextBatchCta={showNextBatchCta}
                  isLoadingNextBatch={isLoadingNextBatch}
                  markingRecommendationId={markingRecommendationId}
                  publicIdentifier={publicIdentifier}
                  sectionScores={profileValidation?.section_scores ?? null}
                  aiProfileIntelligence={aiProfileIntelligence}
                  profileStrengthPercent={profileStrengthPercent}
                  recheckDelta={recheckDelta}
                  isRechecking={isRechecking}
                onRecheckProfile={() => {
                  void handleRecheckProfile();
                }}
                onDismissRecheckDelta={dismissRecheckDelta}
                onCollapse={closeOptimizationPanel}
                  onExpand={expandOptimization}
                  onRefresh={() => {
                    void refreshOptimization();
                  }}
                  onMarkDone={(recommendationId) => {
                    void markOptimizationItemComplete(recommendationId, "done");
                  }}
                  onSkip={(recommendationId) => {
                    void markOptimizationItemComplete(
                      recommendationId,
                      "skipped",
                    );
                  }}
                  onLoadNextBatch={() => {
                    void loadNextOptimizationBatch();
                  }}
                  profilePictureUrl={avatarUrl}
                  localProfilePhotoUrl={localProfilePhotoUrl}
                  transformedProfilePhotoUrl={transformedProfilePhotoUrl}
                  uploadingProfilePhoto={uploadingProfilePhoto}
                  profilePhotoUploadError={profilePhotoUploadError}
                  onUploadProfilePhoto={handleUploadProfilePhoto}
                  transformingProfilePhoto={transformingProfilePhoto}
                  profilePhotoTransformError={profilePhotoTransformError}
                  onMakeProfilePhotoPresentable={
                    handleMakeProfilePhotoPresentable
                  }
                  onDownloadProfilePhoto={handleDownloadProfilePhoto}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      ) : (
        <ProfileOptimizationPanel
          isOpen={isOptimizationOpen}
          isLoading={isOptimizationLoading}
          recommendations={optimizationRecommendations}
          optimizationMeta={optimizationMeta}
          noGapsMessage={
            optimizationMeta?.source === "no_gaps"
              ? (optimizationMeta.message ?? null)
              : null
          }
          isExpanded={isOptimizationExpanded}
          isRefreshing={isOptimizationLoading}
          showNextBatchCta={showNextBatchCta}
          isLoadingNextBatch={isLoadingNextBatch}
          markingRecommendationId={markingRecommendationId}
          publicIdentifier={publicIdentifier}
          sectionScores={profileValidation?.section_scores ?? null}
          aiProfileIntelligence={aiProfileIntelligence}
          profileStrengthPercent={profileStrengthPercent}
          recheckDelta={recheckDelta}
          isRechecking={isRechecking}
          onRecheckProfile={() => {
            void handleRecheckProfile();
          }}
          onDismissRecheckDelta={dismissRecheckDelta}
          onCollapse={collapseOptimization}
          onExpand={expandOptimization}
          onRefresh={() => {
            void refreshOptimization();
          }}
          onMarkDone={(recommendationId) => {
            void markOptimizationItemComplete(recommendationId, "done");
          }}
          onSkip={(recommendationId) => {
            void markOptimizationItemComplete(recommendationId, "skipped");
          }}
          onLoadNextBatch={() => {
            void loadNextOptimizationBatch();
          }}
        />
      )}

      {!centered &&
        (optimizationError || optimizationUserError) &&
        optimizationPanelState === "error" && (
          <AnalysisErrorAlert
            error={
              optimizationError ?? {
                failed_phase: 7,
                phase_label: "Profile Optimization",
                error_code: "optimization_failed",
                user_message:
                  optimizationUserError ??
                  "We couldn't load profile suggestions right now. Please try again.",
              }
            }
            onRetry={() => {
              void retryOptimization();
            }}
            isRetrying={isOptimizationLoading}
          />
      )}

      {/* Transformed profile photo preview modal */}
      <TransformedPhotoPreview
        photoUrl={transformedProfilePhotoUrl ?? ""}
        visible={showTransformedPreview}
        onDownload={handleDownloadProfilePhoto}
        onDismiss={dismissTransformedPreview}
      />

      {!centered &&
        optimizationUserError &&
        optimizationPanelState === "complete" && (
          <AnalysisErrorAlert
            error={{
              failed_phase: 7,
              phase_label: "Profile Optimization",
              error_code: "batch_progression_failed",
              user_message: optimizationUserError,
            }}
            onRetry={() => {
              void retryOptimization();
            }}
          />
        )}

      {foundationStatus === "needs_completion" &&
        questions.length > 0 &&
        (centered ? (
          <ProfileCompletionQuestionsModal
            questions={questions}
            onSubmit={submitCompletion}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        ) : (
          <ProfileCompletionForm
            questions={questions}
            onSubmit={submitCompletion}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        ))}

      {!centered && topicState === "error" && topicError && (
        <AnalysisErrorAlert
          error={topicError}
          onRetry={handleRetryTopic}
          isRetrying={isAnalyzing}
        />
      )}

      {showTopicModal && (
        <DashboardActionModal
          open
          title={isAnalyzing ? "Generating Topic Ideas…" : "Topic Ideas"}
          onClose={closeTopicPanel}
          onBack={topicReturnTo ? handleTopicBack : undefined}
          {...(topicReturnTo
            ? wedgePostSizeSubModalProps(topicReturnTo.label)
            : POST_WEDGE_MODAL_SIZE)}
          modalClassName={
            topicReturnTo
              ? wedgePostSizeModalClassName("linkedin-topic-ideas-modal")
              : "linkedin-topic-ideas-modal"
          }
          titleSize={topicReturnTo ? undefined : "xl"}
          zIndex={12100}
        >
          <TopicRecommendationsPanel
            recommendations={recommendations}
            recommendationsMeta={recommendationsMeta}
            recommendationsError={null}
            analysisError={null}
            isExpanded
            isRefreshing={isAnalyzing}
            variant="modal"
            onRefresh={handleRefreshRecommendations}
            onRetry={handleRetryTopic}
          />
        </DashboardActionModal>
      )}

      {!centered && topicState === "complete" && (
        <TopicRecommendationsPanel
          recommendations={recommendations}
          recommendationsMeta={recommendationsMeta}
          recommendationsError={recommendationsError}
          analysisError={topicError}
          isExpanded={isRecommendationsExpanded}
          isRefreshing={isAnalyzing}
          onCollapse={collapseRecommendations}
          onExpand={expandRecommendations}
          onRefresh={handleRefreshRecommendations}
          onRetry={handleRetryTopic}
        />
      )}
    </div>
  );
};
