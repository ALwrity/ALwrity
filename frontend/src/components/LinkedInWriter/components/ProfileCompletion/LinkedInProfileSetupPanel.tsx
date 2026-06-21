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
    isOptimizationOpen,
    isOptimizationDisabled,
    openOptimizationPanel,
    closeOptimizationPanel,
  } = useLinkedInProfileOptimization(isProfileComplete);

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
          isOptimizationDisabled={isOptimizationDisabled}
          onImproveProfile={openOptimizationPanel}
          onGetTopicIdeas={handleGetTopicIdeas}
        />
      )}

      {foundationStatus === 'error' && foundationError && (
        <AnalysisErrorAlert
          error={foundationError}
          onRetry={handleRetryFoundation}
        />
      )}

      <ProfileOptimizationPanel isOpen={isOptimizationOpen} onClose={closeOptimizationPanel} />

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
        intelligenceSource={aiProfileIntelligenceMeta?.source ?? null}
      />
    </div>
  );
};
