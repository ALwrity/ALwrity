import { useCallback, useEffect, useRef, useState } from 'react';

import {
  completeLinkedInProfile,
  getLinkedInProfile,
  getLinkedInSocialErrorMessage,
  type LinkedInAIProfileIntelligence,
  type LinkedInCompletionQuestion,
  type LinkedInProfileIntelligenceMeta,
  type LinkedInProfileValidation,
} from '../api/linkedinSocial';
import {
  getBackendCooldownSecondsRemaining,
  isBackendCooldownActive,
} from '../api/client';

const RETRY_DELAYS_MS = [0, 2000, 5000];

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

export function useLinkedInProfileCompletion(enabled: boolean) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileValidation, setProfileValidation] =
    useState<LinkedInProfileValidation | null>(null);
  const [questions, setQuestions] = useState<LinkedInCompletionQuestion[]>([]);
  const [aiProfileIntelligence, setAiProfileIntelligence] =
    useState<LinkedInAIProfileIntelligence | null>(null);
  const [aiProfileIntelligenceMeta, setAiProfileIntelligenceMeta] =
    useState<LinkedInProfileIntelligenceMeta | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loadAttemptRef = useRef(0);

  const loadProfile = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const attemptId = ++loadAttemptRef.current;
    setIsLoading(true);
    setError(null);

    let lastError: unknown = null;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
      if (loadAttemptRef.current !== attemptId) {
        return;
      }

      if (attempt > 0) {
        await waitForBackendCooldown();
        await sleep(RETRY_DELAYS_MS[attempt]);
      }

      if (loadAttemptRef.current !== attemptId) {
        return;
      }

      try {
        const data = await getLinkedInProfile();
        if (loadAttemptRef.current !== attemptId) {
          return;
        }
        setProfileValidation(data.profile_validation ?? null);
        setQuestions(data.profile_completion?.questions ?? []);
        setAiProfileIntelligence(data.ai_profile_intelligence ?? null);
        setAiProfileIntelligenceMeta(data.ai_profile_intelligence_meta ?? null);
        setIsLoading(false);
        return;
      } catch (err) {
        lastError = err;
        console.warn(
          `[LinkedInProfileCompletion] load attempt ${attempt + 1}/${RETRY_DELAYS_MS.length} failed:`,
          err
        );
      }
    }

    if (loadAttemptRef.current !== attemptId) {
      return;
    }

    const message = getLinkedInSocialErrorMessage(lastError);
    console.error('[LinkedInProfileCompletion] load failed:', message, lastError);
    setError(message);
    setProfileValidation(null);
    setQuestions([]);
    setAiProfileIntelligence(null);
    setAiProfileIntelligenceMeta(null);
    setIsLoading(false);
  }, [enabled]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const submitCompletion = useCallback(
    async (answers: Record<string, string | string[]>) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await waitForBackendCooldown();
        const result = await completeLinkedInProfile(answers);
        setProfileValidation(result.profile_validation);
        setQuestions(result.profile_completion?.questions ?? []);
        setAiProfileIntelligence(result.ai_profile_intelligence ?? null);
        setAiProfileIntelligenceMeta(result.ai_profile_intelligence_meta ?? null);
      } catch (err) {
        const message = getLinkedInSocialErrorMessage(err);
        console.error('[LinkedInProfileCompletion] submit failed:', message, err);
        setSubmitError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const isProfileComplete = profileValidation?.is_profile_complete ?? false;

  return {
    isLoading,
    error,
    profileValidation,
    questions,
    aiProfileIntelligence,
    aiProfileIntelligenceMeta,
    isProfileComplete,
    isSubmitting,
    submitError,
    submitCompletion,
    refresh: loadProfile,
  };
}
