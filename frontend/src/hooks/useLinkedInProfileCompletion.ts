import { useCallback, useEffect, useRef, useState } from 'react';

import {
  completeLinkedInProfile,
  getLinkedInProfileFoundation,
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
import type { FoundationStatus } from '../components/LinkedInWriter/components/ProfileOptimization/LinkedInAdvisorActionsBar';

const LOG_PREFIX = '[LinkedInProfileCompletion]';
const REC_LOG_PREFIX = '[TopicRecommendations]';
const TOPIC_LOG_PREFIX = '[TopicSuggestion]';

export type TopicAnalysisState = 'idle' | 'running' | 'complete' | 'error';

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

function resolveFoundationStatus(
  data: LinkedInProfileAcquireResponse,
  hadError: boolean
): FoundationStatus {
  if (hadError) {
    return 'error';
  }
  if (!data.profile_validation?.is_profile_complete) {
    return 'needs_completion';
  }
  return 'ready';
}

function resolveTopicState(data: LinkedInProfileAcquireResponse): TopicAnalysisState {
  if (data.analysis_error?.failed_phase === 6) {
    return 'error';
  }
  if (data.recommendations_error) {
    return 'error';
  }
  if (data.recommendations?.length) {
    return 'complete';
  }
  return 'error';
}

function pickFoundationError(
  data: LinkedInProfileAcquireResponse
): LinkedInProfileAnalysisError | null {
  if (!data.analysis_error) {
    return null;
  }
  if (data.analysis_error.failed_phase <= 5) {
    return data.analysis_error;
  }
  return null;
}

function pickTopicError(data: LinkedInProfileAcquireResponse): LinkedInProfileAnalysisError | null {
  if (data.analysis_error && data.analysis_error.failed_phase === 6) {
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
  const [foundationStatus, setFoundationStatus] = useState<FoundationStatus>('loading');
  const [foundationError, setFoundationError] = useState<LinkedInProfileAnalysisError | null>(
    null
  );
  const [lastCompletedPhase, setLastCompletedPhase] = useState<number | null>(null);
  const [profileValidation, setProfileValidation] =
    useState<LinkedInProfileValidation | null>(null);
  const [questions, setQuestions] = useState<LinkedInCompletionQuestion[]>([]);
  const [aiProfileIntelligence, setAiProfileIntelligence] =
    useState<LinkedInAIProfileIntelligence | null>(null);
  const [aiProfileIntelligenceMeta, setAiProfileIntelligenceMeta] =
    useState<LinkedInProfileIntelligenceMeta | null>(null);

  const [topicState, setTopicState] = useState<TopicAnalysisState>('idle');
  const [topicError, setTopicError] = useState<LinkedInProfileAnalysisError | null>(null);
  const [recommendations, setRecommendations] = useState<LinkedInTopicRecommendation[] | null>(
    null
  );
  const [recommendationsMeta, setRecommendationsMeta] =
    useState<LinkedInTopicRecommendationsMeta | null>(null);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [isRecommendationsExpanded, setIsRecommendationsExpanded] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const foundationAttemptRef = useRef(0);
  const topicAttemptRef = useRef(0);

  const applyFoundationResponse = useCallback((data: LinkedInProfileAcquireResponse) => {
    setProfileValidation(data.profile_validation ?? null);
    setQuestions(data.profile_completion?.questions ?? []);
    setAiProfileIntelligence(data.ai_profile_intelligence ?? null);
    setAiProfileIntelligenceMeta(data.ai_profile_intelligence_meta ?? null);
    setLastCompletedPhase(data.last_completed_phase ?? null);

    const foundationErr = pickFoundationError(data);
    setFoundationError(foundationErr);
    if (foundationErr) {
      logProfileAnalysisError('foundation load returned error', foundationErr);
    }

    const nextFoundationStatus = resolveFoundationStatus(data, Boolean(foundationErr));
    setFoundationStatus(nextFoundationStatus);

    console.info(`${LOG_PREFIX} foundation response applied`, {
      foundationStatus: nextFoundationStatus,
      lastCompletedPhase: data.last_completed_phase ?? null,
      isProfileComplete: data.profile_validation?.is_profile_complete ?? false,
      hasFoundationError: Boolean(foundationErr),
    });
  }, []);

  const applyTopicResponse = useCallback((data: LinkedInProfileAcquireResponse) => {
    setProfileValidation(data.profile_validation ?? null);
    setAiProfileIntelligence(data.ai_profile_intelligence ?? null);
    setAiProfileIntelligenceMeta(data.ai_profile_intelligence_meta ?? null);
    setLastCompletedPhase(data.last_completed_phase ?? null);
    setRecommendations(data.recommendations ?? null);
    setRecommendationsMeta(data.recommendations_meta ?? null);
    setRecommendationsError(data.recommendations_error ?? null);

    const displayError = pickTopicError(data);
    setTopicError(displayError);
    if (displayError) {
      logProfileAnalysisError('topic analysis returned error', displayError);
    }

    const nextTopicState = resolveTopicState(data);
    setTopicState(nextTopicState);
    if (nextTopicState === 'complete') {
      setIsRecommendationsExpanded(true);
    }

    console.info(`${TOPIC_LOG_PREFIX} topic response applied`, {
      topicState: nextTopicState,
      recommendationCount: data.recommendations?.length ?? 0,
      hasTopicError: Boolean(displayError),
    });
  }, []);

  const loadFoundation = useCallback(async () => {
    const attemptId = ++foundationAttemptRef.current;
    console.info(`${LOG_PREFIX} foundation load start`);
    setFoundationStatus('loading');
    setFoundationError(null);

    try {
      await waitForBackendCooldown();
      const data = await getLinkedInProfileFoundation();
      if (foundationAttemptRef.current !== attemptId) {
        return;
      }
      applyFoundationResponse(data);
    } catch (err) {
      if (foundationAttemptRef.current !== attemptId) {
        return;
      }
      const mapped = mapProfileHttpErrorToAnalysisError(err);
      logProfileAnalysisError('foundation HTTP request failed', mapped);
      setFoundationError(mapped);
      setFoundationStatus('error');
      console.error(`${LOG_PREFIX} foundation load failed`, mapped);
    }
  }, [applyFoundationResponse]);

  useEffect(() => {
    void loadFoundation();
  }, [loadFoundation]);

  const runTopicAnalysis = useCallback(
    async (forceRegenerate = false) => {
      const attemptId = ++topicAttemptRef.current;
      console.info(`${TOPIC_LOG_PREFIX} user triggered topic analysis`, { forceRegenerate });
      setTopicState('running');
      setTopicError(null);
      setRecommendationsError(null);
      setIsRecommendationsExpanded(true);

      try {
        await waitForBackendCooldown();
        const data = await runLinkedInTopicAnalysis({ forceRegenerate });
        if (topicAttemptRef.current !== attemptId) {
          return;
        }
        applyTopicResponse(data);
      } catch (err) {
        if (topicAttemptRef.current !== attemptId) {
          return;
        }
        const mapped = mapProfileHttpErrorToAnalysisError(err);
        logProfileAnalysisError('topic HTTP request failed', mapped);
        setTopicError(mapped);
        setTopicState('error');
        setRecommendations(null);
        setRecommendationsMeta(null);
        setRecommendationsError(mapped.user_message);
      }
    },
    [applyTopicResponse]
  );

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
            `${LOG_PREFIX} profile now complete — reloading foundation only (no Phase 6 auto-run)`
          );
          await loadFoundation();
        } else {
          setFoundationStatus('needs_completion');
          setTopicState('idle');
          setRecommendations(null);
          setRecommendationsMeta(null);
          setRecommendationsError(null);
          setTopicError(null);
          setFoundationError(null);
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
    [loadFoundation]
  );

  const collapseRecommendations = useCallback(() => {
    console.info(`${REC_LOG_PREFIX} user collapsed topic list`);
    setIsRecommendationsExpanded(false);
  }, []);

  const expandRecommendations = useCallback(() => {
    console.info(`${REC_LOG_PREFIX} user expanded topic list`);
    setIsRecommendationsExpanded(true);
  }, []);

  const isProfileComplete = profileValidation?.is_profile_complete ?? false;
  const isAnalyzing = topicState === 'running';
  const hasTopicResults = topicState === 'complete' || topicState === 'error';

  return {
    foundationStatus,
    foundationError,
    lastCompletedPhase,
    topicState,
    topicError,
    analysisState: topicState,
    analysisError: topicError ?? foundationError,
    isAnalyzing,
    hasTopicResults,
    profileValidation,
    questions,
    aiProfileIntelligence,
    aiProfileIntelligenceMeta,
    recommendations,
    recommendationsMeta,
    recommendationsError,
    isRecommendationsExpanded,
    collapseRecommendations,
    expandRecommendations,
    isProfileComplete,
    isSubmitting,
    submitError,
    loadFoundation,
    runTopicAnalysis,
    submitCompletion,
  };
}
