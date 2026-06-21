import React from 'react';

import { useLinkedInProfileCompletion } from '../../../../hooks/useLinkedInProfileCompletion';
import { LinkedInConnectedProfileCard } from '../LinkedInConnectedProfileCard';
import { TopicRecommendationsPanel } from '../TopicRecommendations/TopicRecommendationsPanel';
import {
  AnalysisErrorAlert,
  TopicSuggestionIntro,
} from '../TopicRecommendations/TopicSuggestionIntro';
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
    analysisState,
    analysisError,
    isAnalyzing,
    questions,
    isSubmitting,
    submitError,
    recommendations,
    recommendationsMeta,
    recommendationsError,
    runTopicAnalysis,
    submitCompletion,
  } = useLinkedInProfileCompletion();

  const handleRunAnalysis = () => {
    void runTopicAnalysis();
  };

  const handleRetry = () => {
    void runTopicAnalysis();
  };

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      <LinkedInConnectedProfileCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        onDisconnect={onDisconnect}
        isDisconnecting={isDisconnecting}
        disconnectError={disconnectError}
      />

      {analysisState === 'idle' && (
        <TopicSuggestionIntro isAnalyzing={false} onRunAnalysis={handleRunAnalysis} />
      )}

      {analysisState === 'running' && (
        <TopicSuggestionIntro isAnalyzing onRunAnalysis={handleRunAnalysis} />
      )}

      {analysisState === 'needs_completion' && questions.length > 0 && (
        <ProfileCompletionForm
          questions={questions}
          onSubmit={submitCompletion}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      )}

      {analysisState === 'error' && analysisError && (
        <AnalysisErrorAlert
          error={analysisError}
          onRetry={handleRetry}
          isRetrying={isAnalyzing}
        />
      )}

      {analysisState === 'complete' && (
        <TopicRecommendationsPanel
          recommendations={recommendations}
          recommendationsMeta={recommendationsMeta}
          recommendationsError={recommendationsError}
          analysisError={analysisError}
          isRefreshing={isAnalyzing}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
};
