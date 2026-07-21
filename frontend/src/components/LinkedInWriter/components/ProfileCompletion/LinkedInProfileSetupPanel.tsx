import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLinkedInProfileCompletion } from '../../../../hooks/useLinkedInProfileCompletion';
import { useLinkedInProfileOptimization } from '../../../../hooks/useLinkedInProfileOptimization';
import { LinkedInConnectedProfileCard } from '../LinkedInConnectedProfileCard';
import { LinkedInProfileHubStrip } from '../LinkedInProfileHubStrip';
import { TopicRecommendationsPanel } from '../TopicRecommendations/TopicRecommendationsPanel';
import { AnalysisErrorAlert } from '../TopicRecommendations/TopicSuggestionIntro';
import { LinkedInAdvisorActionsBar } from '../ProfileOptimization/LinkedInAdvisorActionsBar';
import { ProfileOptimizationPanel } from '../ProfileOptimization/ProfileOptimizationPanel';
import { ProfileCompletionForm } from './ProfileCompletionForm';
import {
  ProfileAnalysisReadyModal,
  buildProfileActionPoints,
} from '../dashboard/ProfileAnalysisReadyModal';
import {
  getDisplayProfileStrengthPercent,
  getProfileStrengthDisplayLabel,
  getProfileStrengthTooltip,
} from '../../utils/profileStrengthUtils';
import { DashboardErrorModal } from '../dashboard/DashboardErrorModal';
import { DashboardActionModal } from '../dashboard/DashboardActionModal';
import { buildDashboardErrorConfig } from '../dashboard/dashboardErrorConfig';

const ANALYSIS_MODAL_DISMISSED_KEY = 'linkedin_profile_analysis_modal_dismissed_v2';
const DISMISSAL_EXPIRY_HOURS = 24;

/** Check if dismissal is still valid (within expiry window) */
function isDismissalValid(): boolean {
  try {
    const raw = localStorage.getItem(ANALYSIS_MODAL_DISMISSED_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { timestamp: number; expires: number };
    if (!data.expires) return false;
    return Date.now() < data.expires;
  } catch {
    return false;
  }
}

/** Store dismissal with 24-hour expiry */
function storeDismissal(): void {
  try {
    const dismissForHours = DISMISSAL_EXPIRY_HOURS;
    localStorage.setItem(
      ANALYSIS_MODAL_DISMISSED_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        expires: Date.now() + dismissForHours * 60 * 60 * 1000,
      })
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
}

export const LinkedInProfileSetupPanel: React.FC<LinkedInProfileSetupPanelProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
  centered = false,
  hideDisconnectButton = false,
  mobileProfileStrip = false,
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
  } = useLinkedInProfileCompletion();

  const publicIdentifier =
    typeof profile?.public_identifier === 'string' ? profile.public_identifier : null;

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
  } = useLinkedInProfileOptimization(isProfileComplete);

  const handleImproveProfile = () => {
    void openOptimizationPanel();
  };

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
    (foundationStatus === 'loading' ||
      foundationStatus === 'ready' ||
      foundationStatus === 'needs_completion' ||
      (foundationStatus === 'error' && !questions.length));

  const profileStrengthPercent = getDisplayProfileStrengthPercent(profileValidation);
  const strengthLabel = getProfileStrengthDisplayLabel(profileValidation, profileStrengthPercent);
  const strengthTooltip = getProfileStrengthTooltip(profileValidation);

  const actionPoints = useMemo(
    () =>
      buildProfileActionPoints(
        profileValidation?.missing_fields,
        profileValidation?.optional_missing_fields,
        aiProfileIntelligence?.writing_opportunities,
        profileValidation?.optimization_gaps_count
      ),
    [profileValidation, aiProfileIntelligence]
  );

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [isTopicPanelOpen, setIsTopicPanelOpen] = useState(false);
  const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);

  // TC-007: Auto-show analysis modal when profile data is ready and not recently dismissed
  useEffect(() => {
    if (
      centered &&
      foundationStatus === 'ready' &&
      profileValidation &&
      !isDismissalValid()
    ) {
      setShowAnalysisModal(true);
    }
  }, [centered, foundationStatus, profileValidation]);

  const closeTopicPanel = () => {
    setIsTopicPanelOpen(false);
    collapseRecommendations();
  };

  const showTopicModal =
    centered &&
    isTopicPanelOpen &&
    (topicState === 'running' || topicState === 'complete');

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
    ]
  );

  useEffect(() => {
    if (isOptimizationLoading || isAnalyzing) {
      setDismissedErrorKey(null);
    }
  }, [isOptimizationLoading, isAnalyzing]);

  const showDashboardErrorModal = Boolean(
    centered &&
      dashboardErrorConfig &&
      dismissedErrorKey !== dashboardErrorConfig.key
  );

  useEffect(() => {
    if (topicState === 'error') {
      setIsTopicPanelOpen(false);
    }
  }, [topicState]);

  useEffect(() => {
    const onGetTopicIdeas = () => {
      setIsTopicPanelOpen(true);
      void runTopicAnalysis(false);
    };
    const onOpenOptimise = () => {
      void openOptimizationPanel();
    };
    window.addEventListener('linkedinwriter:getTopicIdeas', onGetTopicIdeas);
    window.addEventListener('linkedinwriter:openOptimiseProfile', onOpenOptimise);
    return () => {
      window.removeEventListener('linkedinwriter:getTopicIdeas', onGetTopicIdeas);
      window.removeEventListener('linkedinwriter:openOptimiseProfile', onOpenOptimise);
    };
  }, [runTopicAnalysis, openOptimizationPanel]);

  const dismissAnalysisModal = () => {
    storeDismissal();
    setShowAnalysisModal(false);
  };

  const handleOptimiseFromModal = () => {
    dismissAnalysisModal();
    void openOptimizationPanel();
  };

  return (
    <div style={{ width: '100%', maxWidth: centered ? undefined : 1200 }}>
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
          isOptimiseDisabled={isOptimizationDisabled || foundationStatus !== 'ready'}
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

      {!centered && foundationStatus === 'error' && foundationError && (
        <AnalysisErrorAlert
          error={foundationError}
          onRetry={handleRetryFoundation}
        />
      )}

      {centered ? (
        isOptimizationOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="linkedin-profile-optimization-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Profile optimization suggestions"
            onClick={() => closeOptimizationPanel()}
          >
            <div
              className="linkedin-profile-optimization-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="linkedin-profile-optimization-dialog__close-row">
                <button
                  type="button"
                  className="linkedin-profile-optimization-dialog__close"
                  onClick={() => closeOptimizationPanel()}
                  aria-label="Close profile optimization"
                >
                  ✕
                </button>
              </div>
              <div className="linkedin-profile-optimization-dialog__body">
              <ProfileOptimizationPanel
                isOpen={isOptimizationOpen}
                isLoading={isOptimizationLoading}
                recommendations={optimizationRecommendations}
                optimizationMeta={optimizationMeta}
                noGapsMessage={
                  optimizationMeta?.source === 'no_gaps' ? optimizationMeta.message ?? null : null
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
                  void recheckProfile();
                }}
                onDismissRecheckDelta={dismissRecheckDelta}
                onCollapse={closeOptimizationPanel}
                onExpand={expandOptimization}
                onRefresh={() => {
                  void refreshOptimization();
                }}
                onMarkDone={(recommendationId) => {
                  void markOptimizationItemComplete(recommendationId, 'done');
                }}
                onSkip={(recommendationId) => {
                  void markOptimizationItemComplete(recommendationId, 'skipped');
                }}
                onLoadNextBatch={() => {
                  void loadNextOptimizationBatch();
                }}
              />
              </div>
            </div>
          </div>,
          document.body
        )
      ) : (
        <ProfileOptimizationPanel
          isOpen={isOptimizationOpen}
          isLoading={isOptimizationLoading}
          recommendations={optimizationRecommendations}
          optimizationMeta={optimizationMeta}
          noGapsMessage={
            optimizationMeta?.source === 'no_gaps' ? optimizationMeta.message ?? null : null
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
            void recheckProfile();
          }}
          onDismissRecheckDelta={dismissRecheckDelta}
          onCollapse={collapseOptimization}
          onExpand={expandOptimization}
          onRefresh={() => {
            void refreshOptimization();
          }}
          onMarkDone={(recommendationId) => {
            void markOptimizationItemComplete(recommendationId, 'done');
          }}
          onSkip={(recommendationId) => {
            void markOptimizationItemComplete(recommendationId, 'skipped');
          }}
          onLoadNextBatch={() => {
            void loadNextOptimizationBatch();
          }}
        />
      )}

      {!centered &&
        (optimizationError || optimizationUserError) &&
        optimizationPanelState === 'error' && (
        <AnalysisErrorAlert
          error={
            optimizationError ?? {
              failed_phase: 7,
              phase_label: 'Profile Optimization',
              error_code: 'optimization_failed',
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

      {!centered && optimizationUserError && optimizationPanelState === 'complete' && (
        <AnalysisErrorAlert
          error={{
            failed_phase: 7,
            phase_label: 'Profile Optimization',
            error_code: 'batch_progression_failed',
            user_message: optimizationUserError,
          }}
          onRetry={() => {
            void retryOptimization();
          }}
        />
      )}

      {foundationStatus === 'needs_completion' && questions.length > 0 && (
        <ProfileCompletionForm
          questions={questions}
          onSubmit={submitCompletion}
          isSubmitting={isSubmitting}
          error={centered ? null : submitError}
        />
      )}

      {!centered && topicState === 'error' && topicError && (
        <AnalysisErrorAlert
          error={topicError}
          onRetry={handleRetryTopic}
          isRetrying={isAnalyzing}
        />
      )}

      {showTopicModal && (
        <DashboardActionModal
          open
          title={isAnalyzing ? 'Generating topic ideas…' : 'Topic ideas'}
          onClose={closeTopicPanel}
          maxWidth={640}
          maxHeight="min(90vh, 720px)"
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

      {!centered && topicState === 'complete' && (
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
