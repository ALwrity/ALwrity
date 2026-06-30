import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLinkedInProfileCompletion } from '../../../../hooks/useLinkedInProfileCompletion';
import { useLinkedInProfileOptimization } from '../../../../hooks/useLinkedInProfileOptimization';
import { LinkedInConnectedProfileCard } from '../LinkedInConnectedProfileCard';
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

const ANALYSIS_MODAL_DISMISSED_KEY = 'linkedin_profile_analysis_modal_dismissed';

interface LinkedInProfileSetupPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
  centered?: boolean;
  hideDisconnectButton?: boolean;
}

export const LinkedInProfileSetupPanel: React.FC<LinkedInProfileSetupPanelProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
  centered = false,
  hideDisconnectButton = false,
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
    profileValidation,
    aiProfileIntelligence,
    loadFoundation,
    runTopicAnalysis,
    submitCompletion,
  } = useLinkedInProfileCompletion();

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
    sessionStorage.setItem(ANALYSIS_MODAL_DISMISSED_KEY, '1');
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

      <LinkedInConnectedProfileCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={onDisconnect}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
        centered={centered}
        onOptimiseProfile={centered ? handleImproveProfile : undefined}
        strengthTooltip={centered ? strengthTooltip : undefined}
        isOptimiseDisabled={isOptimizationDisabled || foundationStatus !== 'ready'}
        isOptimiseLoading={isOptimizationLoading}
        hideDisconnectButton={hideDisconnectButton}
      />

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
            role="dialog"
            aria-modal="true"
            aria-label="Profile optimization suggestions"
            onClick={() => closeOptimizationPanel()}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 12100,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              overflowY: 'auto',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(980px, 100%)',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => closeOptimizationPanel()}
                  aria-label="Close profile optimization"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.7)',
                    background: 'rgba(255,255,255,0.92)',
                    color: '#334155',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>
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
          disableClose={isAnalyzing}
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
