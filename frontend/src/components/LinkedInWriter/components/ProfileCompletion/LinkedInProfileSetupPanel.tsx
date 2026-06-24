import React from 'react';

import { useLinkedInProfileCompletion } from '../../../../hooks/useLinkedInProfileCompletion';
import { useLinkedInProfileOptimization } from '../../../../hooks/useLinkedInProfileOptimization';
import { LinkedInConnectedProfileCard } from '../LinkedInConnectedProfileCard';
import { TopicRecommendationsPanel } from '../TopicRecommendations/TopicRecommendationsPanel';
import { AnalysisErrorAlert } from '../TopicRecommendations/TopicSuggestionIntro';
import { LinkedInAdvisorActionsBar } from '../ProfileOptimization/LinkedInAdvisorActionsBar';
import { LinkedInProfileDebugStrip } from '../ProfileOptimization/LinkedInProfileDebugStrip';
import { ProfileOptimizationPanel } from '../ProfileOptimization/ProfileOptimizationPanel';
import { ProfileCompletionForm } from './ProfileCompletionForm';

interface LinkedInProfileSetupPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
}

export const LinkedInProfileSetupPanel: React.FC<LinkedInProfileSetupPanelProps> = ({
  displayName,
  avatarUrl,
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
}) => {
  const {
    foundationStatus,
    foundationError,
    lastCompletedPhase,
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
    aiProfileIntelligenceMeta,
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
    void runTopicAnalysis(false);
  };

  const handleRetryTopic = () => {
    void runTopicAnalysis(false);
  };

  const handleRefreshRecommendations = () => {
    void runTopicAnalysis(true);
  };

  const handleRetryFoundation = () => {
    void loadFoundation();
  };

  const showAdvisorBar =
    foundationStatus === 'loading' ||
    foundationStatus === 'ready' ||
    foundationStatus === 'needs_completion' ||
    (foundationStatus === 'error' && !questions.length);

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <LinkedInConnectedProfileCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={onDisconnect}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
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

      {foundationStatus === 'error' && foundationError && (
        <AnalysisErrorAlert
          error={foundationError}
          onRetry={handleRetryFoundation}
        />
      )}

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

      {(optimizationError || optimizationUserError) &&
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

      {optimizationUserError && optimizationPanelState === 'complete' && (
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
          error={submitError}
        />
      )}

      {topicState === 'error' && topicError && (
        <AnalysisErrorAlert
          error={topicError}
          onRetry={handleRetryTopic}
          isRetrying={isAnalyzing}
        />
      )}

      {topicState === 'complete' && (
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

      <LinkedInProfileDebugStrip
        lastCompletedPhase={lastCompletedPhase}
        isProfileComplete={isProfileComplete}
        foundationError={foundationError}
        topicError={topicError}
        optimizationError={optimizationError}
        intelligenceSource={aiProfileIntelligenceMeta?.source ?? null}
      />
    </div>
  );
};
