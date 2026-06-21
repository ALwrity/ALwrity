import { useCallback, useRef, useState } from 'react';

import {
  completeLinkedInProfile,
  getLinkedInSocialErrorMessage,
  logProfileAnalysisError,
  mapProfileHttpErrorToAnalysisError,
  runLinkedInTopicAnalysis,
  type LinkedInAIProfileIntelligence,
  type LinkedInCompletionQuestion,
  type LinkedInProfileAcquireResponse,
  type LinkedInProfileAnalysisError,
  type LinkedInProfileIntelligenceMeta,
  type LinkedInProfileValidation,
  type LinkedInTopicRecommendation,
  type LinkedInTopicRecommendationsMeta,
} from '../api/linkedinSocial';
import {
  getBackendCooldownSecondsRemaining,
  isBackendCooldownActive,
} from '../api/client';

const LOG_PREFIX = '[LinkedInProfileCompletion]';
const REC_LOG_PREFIX = '[TopicRecommendations]';
const TOPIC_LOG_PREFIX = '[TopicSuggestion]';

export type TopicAnalysisState =
  | 'idle'
  | 'running'
  | 'needs_completion'
  | 'complete'
  | 'error';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

async function waitForBackendCooldown(): Promise<void> {
  while (isBackendCooldownActive()) {
    const seconds = getBackendCooldownSecondsRemaining();
    await sleep(Math.max(seconds, 1) * 1000);
  }
}

function resolveAnalysisState(
  data: LinkedInProfileAcquireResponse
): TopicAnalysisState {
  if (data.analysis_error) {
    return 'error';
  }
  if (!data.profile_validation?.is_profile_complete) {
    return 'needs_completion';
  }
  if (data.recommendations_error || !data.recommendations?.length) {
    return 'error';
  }
  return 'complete';
}

function pickDisplayError(
  data: LinkedInProfileAcquireResponse
): LinkedInProfileAnalysisError | null {
  if (data.analysis_error) {
    return data.analysis_error;
  }
  if (data.recommendations_error) {
    return {
      failed_phase: 6,
      phase_label: 'Topic Recommendations',
      error_code: 'recommendations_failed',
      user_message: data.recommendations_error,
      debug_message: `last_completed_phase=${data.last_completed_phase ?? 'unknown'}`,
    };
  }
  return null;
}

export function useLinkedInProfileCompletion() {
  const [analysisState, setAnalysisState] = useState<TopicAnalysisState>('idle');
  const [analysisError, setAnalysisError] = useState<LinkedInProfileAnalysisError | null>(
    null
  );
  const [profileValidation, setProfileValidation] =
    useState<LinkedInProfileValidation | null>(null);
  const [questions, setQuestions] = useState<LinkedInCompletionQuestion[]>([]);
  const [aiProfileIntelligence, setAiProfileIntelligence] =
    useState<LinkedInAIProfileIntelligence | null>(null);
  const [aiProfileIntelligenceMeta, setAiProfileIntelligenceMeta] =
    useState<LinkedInProfileIntelligenceMeta | null>(null);
  const [recommendations, setRecommendations] = useState<LinkedInTopicRecommendation[] | null>(
    null
  );
  const [recommendationsMeta, setRecommendationsMeta] =
    useState<LinkedInTopicRecommendationsMeta | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const analysisAttemptRef = useRef(0);

  const applyProfileResponse = useCallback((data: LinkedInProfileAcquireResponse) => {
    setProfileValidation(data.profile_validation ?? null);
    setQuestions(data.profile_completion?.questions ?? []);
    setAiProfileIntelligence(data.ai_profile_intelligence ?? null);
    setAiProfileIntelligenceMeta(data.ai_profile_intelligence_meta ?? null);
    setRecommendations(data.recommendations ?? null);
    setRecommendationsMeta(data.recommendations_meta ?? null);
    setRecommendationsError(data.recommendations_error ?? null);

    const displayError = pickDisplayError(data);
    setAnalysisError(displayError);

    if (displayError) {
      logProfileAnalysisError('pipeline returned error', displayError);
    }

    const nextState = resolveAnalysisState(data);
    setAnalysisState(nextState);

    console.info(`${TOPIC_LOG_PREFIX} pipeline response applied`, {
      analysisState: nextState,
      lastCompletedPhase: data.last_completed_phase ?? null,
      isProfileComplete: data.profile_validation?.is_profile_complete ?? false,
      recommendationCount: data.recommendations?.length ?? 0,
      hasAnalysisError: Boolean(data.analysis_error),
      hasRecommendationsError: Boolean(data.recommendations_error),
    });
  }, []);

  const runTopicAnalysis = useCallback(async () => {
    const attemptId = ++analysisAttemptRef.current;
    console.info(`${TOPIC_LOG_PREFIX} user triggered analysis`);
    setAnalysisState('running');
    setAnalysisError(null);
    setRecommendationsError(null);

    try {
      await waitForBackendCooldown();
      const data = await runLinkedInTopicAnalysis();
      if (analysisAttemptRef.current !== attemptId) {
        return;
      }
      applyProfileResponse(data);
    } catch (err) {
      if (analysisAttemptRef.current !== attemptId) {
        return;
      }
      const mapped = mapProfileHttpErrorToAnalysisError(err);
      logProfileAnalysisError('HTTP request failed', mapped);
      setAnalysisError(mapped);
      setAnalysisState('error');
      setRecommendations(null);
      setRecommendationsMeta(null);
      setRecommendationsError(mapped.user_message);
    }
  }, [applyProfileResponse]);

  const submitCompletion = useCallback(
    async (answers: Record<string, string | string[]>) => {
      setIsSubmitting(true);
      setSubmitError(null);
      console.info(`${LOG_PREFIX} submit start`, { answerKeys: Object.keys(answers) });

      try {
        await waitForBackendCooldown();
        const result = await completeLinkedInProfile(answers);
        setProfileValidation(result.profile_validation);
        setQuestions(result.profile_completion?.questions ?? []);

        if (result.profile_validation.is_profile_complete) {
          console.info(
            `${LOG_PREFIX} profile now complete — continuing topic analysis (Phases 5–6)`
          );
          await runTopicAnalysis();
        } else {
          setAnalysisState('needs_completion');
          setRecommendations(null);
          setRecommendationsMeta(null);
          setRecommendationsError(null);
          setAnalysisError(null);
        }

        console.info(`${LOG_PREFIX} submit complete`, {
          isProfileComplete: result.profile_validation.is_profile_complete,
        });
      } catch (err) {
        const message = getLinkedInSocialErrorMessage(err);
        console.error(`${LOG_PREFIX} submit failed:`, message, err);
        setSubmitError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [runTopicAnalysis]
  );

  const isProfileComplete = profileValidation?.is_profile_complete ?? false;
  const isAnalyzing = analysisState === 'running';
  const hasStartedAnalysis = analysisState !== 'idle';

  return {
    analysisState,
    analysisError,
    isAnalyzing,
    hasStartedAnalysis,
    profileValidation,
    questions,
    aiProfileIntelligence,
    aiProfileIntelligenceMeta,
    recommendations,
    recommendationsMeta,
    recommendationsError,
    isProfileComplete,
    isSubmitting,
    submitError,
    runTopicAnalysis,
    submitCompletion,
  };
}
