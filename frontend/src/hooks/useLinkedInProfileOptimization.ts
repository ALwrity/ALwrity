import { useCallback, useState } from 'react';

import {
  completeProfileOptimizationRecommendation,
  getLinkedInSocialErrorMessage,
  loadNextProfileOptimizationBatch,
  logProfileAnalysisError,
  runLinkedInProfileOptimization,
  type LinkedInProfileAnalysisError,
  type LinkedInProfileOptimizationBatchActionResponse,
  type LinkedInProfileOptimizationItem,
  type LinkedInProfileOptimizationMeta,
} from '../api/linkedinSocial';

const LOG_PREFIX = '[ProfileOptimization]';

export type ProfileOptimizationPanelState =
  | 'idle'
  | 'loading'
  | 'complete'
  | 'no_gaps'
  | 'error';

/**
 * Phase 7 — load profile optimization recommendations when user clicks Improve My Profile.
 */
export function useLinkedInProfileOptimization(isProfileComplete: boolean) {
  const [panelState, setPanelState] = useState<ProfileOptimizationPanelState>('idle');
  const [recommendations, setRecommendations] = useState<LinkedInProfileOptimizationItem[] | null>(
    null
  );
  const [optimizationMeta, setOptimizationMeta] =
    useState<LinkedInProfileOptimizationMeta | null>(null);
  const [optimizationError, setOptimizationError] =
    useState<LinkedInProfileAnalysisError | null>(null);
  const [optimizationUserError, setOptimizationUserError] = useState<string | null>(null);
  const [isOptimizationExpanded, setIsOptimizationExpanded] = useState(true);
  const [markingRecommendationId, setMarkingRecommendationId] = useState<string | null>(null);
  const [isLoadingNextBatch, setIsLoadingNextBatch] = useState(false);
  const [showNextBatchCta, setShowNextBatchCta] = useState(false);

  const applyBatchActionResponse = useCallback(
    (data: LinkedInProfileOptimizationBatchActionResponse) => {
      setRecommendations(data.profile_optimization);
      setOptimizationMeta(data.profile_optimization_meta);
      setShowNextBatchCta(Boolean(data.show_next_batch_cta));
      setPanelState('complete');
      setIsOptimizationExpanded(true);
      console.info(`${LOG_PREFIX} batch action applied`, {
        activeCount: data.profile_optimization.length,
        remainingInBacklog: data.profile_optimization_meta.remaining_in_backlog ?? 0,
        showNextBatchCta: data.show_next_batch_cta,
        batchIndex: data.profile_optimization_meta.active_batch_index ?? 0,
      });
    },
    []
  );

  const loadOptimization = useCallback(async (forceRegenerate = false) => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} load blocked — profile incomplete`);
      return;
    }

    console.info(`${LOG_PREFIX} loading profile optimization`, { forceRegenerate });
    setPanelState('loading');
    setOptimizationError(null);
    setOptimizationUserError(null);
    setShowNextBatchCta(false);
    setIsOptimizationExpanded(true);

    try {
      const data = await runLinkedInProfileOptimization({ forceRegenerate });
      const items = data.profile_optimization ?? null;
      const meta = data.profile_optimization_meta ?? null;

      if (data.analysis_error?.failed_phase === 7) {
        logProfileAnalysisError('analysis_error from API', data.analysis_error);
        setOptimizationError(data.analysis_error);
        setRecommendations(null);
        setOptimizationMeta(null);
        setOptimizationUserError(
          data.profile_optimization_error ??
            data.analysis_error.user_message ??
            "We couldn't load profile suggestions right now. Please try again."
        );
        setPanelState('error');
        return;
      }

      if (data.profile_optimization_error) {
        setOptimizationUserError(data.profile_optimization_error);
        setOptimizationError(null);
        setRecommendations(null);
        setOptimizationMeta(meta);
        setPanelState('error');
        return;
      }

      if (meta?.source === 'no_gaps') {
        setRecommendations([]);
        setOptimizationMeta(meta);
        setShowNextBatchCta(false);
        setPanelState('no_gaps');
        console.info(`${LOG_PREFIX} no gaps — profile looks strong`);
        return;
      }

      if (!items || items.length === 0) {
        if ((meta?.remaining_in_backlog ?? 0) > 0) {
          setRecommendations([]);
          setOptimizationMeta(meta);
          setShowNextBatchCta(true);
          setPanelState('complete');
          console.info(`${LOG_PREFIX} active batch cleared — next batch available`, {
            remainingInBacklog: meta?.remaining_in_backlog ?? 0,
          });
          return;
        }
        setOptimizationUserError('No profile suggestions were returned. Please try again.');
        setRecommendations(null);
        setOptimizationMeta(meta);
        setPanelState('error');
        return;
      }

      setRecommendations(items);
      setOptimizationMeta(meta);
      setShowNextBatchCta(false);
      setPanelState('complete');
      setIsOptimizationExpanded(true);
      console.info(`${LOG_PREFIX} loaded recommendations`, {
        count: items.length,
        source: meta?.source,
        remainingInBacklog: meta?.remaining_in_backlog ?? 0,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load profile optimization suggestions';
      console.error(`${LOG_PREFIX} load failed:`, message, err);
      setOptimizationUserError(message);
      setOptimizationError(null);
      setPanelState('error');
    }
  }, [isProfileComplete]);

  const markOptimizationItemComplete = useCallback(
    async (recommendationId: string, status: 'done' | 'skipped' = 'done') => {
      console.info(`${LOG_PREFIX} marking item`, { recommendationId, status });
      setMarkingRecommendationId(recommendationId);
      setOptimizationUserError(null);

      try {
        const data = await completeProfileOptimizationRecommendation(recommendationId, status);
        applyBatchActionResponse(data);
      } catch (err) {
        const message = getLinkedInSocialErrorMessage(err);
        console.error(`${LOG_PREFIX} mark item failed`, { recommendationId, message, err });
        setOptimizationUserError(message);
      } finally {
        setMarkingRecommendationId(null);
      }
    },
    [applyBatchActionResponse]
  );

  const loadNextOptimizationBatch = useCallback(async () => {
    console.info(`${LOG_PREFIX} user requested next batch`);
    setIsLoadingNextBatch(true);
    setOptimizationUserError(null);

    try {
      const data = await loadNextProfileOptimizationBatch();
      applyBatchActionResponse(data);
    } catch (err) {
      const message = getLinkedInSocialErrorMessage(err);
      console.error(`${LOG_PREFIX} next batch failed`, { message, err });
      setOptimizationUserError(message);
    } finally {
      setIsLoadingNextBatch(false);
    }
  }, [applyBatchActionResponse]);

  const openOptimizationPanel = useCallback(async () => {
    await loadOptimization(false);
  }, [loadOptimization]);

  const closeOptimizationPanel = useCallback(() => {
    console.info(`${LOG_PREFIX} user collapsed profile optimization panel to idle`);
    setPanelState('idle');
    setOptimizationUserError(null);
    setIsOptimizationExpanded(true);
    setShowNextBatchCta(false);
  }, []);

  const collapseOptimization = useCallback(() => {
    console.info(`${LOG_PREFIX} user collapsed profile optimization list`);
    setIsOptimizationExpanded(false);
  }, []);

  const expandOptimization = useCallback(() => {
    console.info(`${LOG_PREFIX} user expanded profile optimization list`);
    setIsOptimizationExpanded(true);
  }, []);

  const retryOptimization = useCallback(async () => {
    await loadOptimization(false);
  }, [loadOptimization]);

  const refreshOptimization = useCallback(async () => {
    await loadOptimization(true);
  }, [loadOptimization]);

  return {
    optimizationPanelState: panelState,
    isOptimizationOpen:
      panelState === 'loading' || panelState === 'complete' || panelState === 'no_gaps',
    isOptimizationLoading: panelState === 'loading',
    isOptimizationDisabled: !isProfileComplete,
    recommendations,
    optimizationMeta,
    optimizationError,
    optimizationUserError,
    isOptimizationExpanded,
    markingRecommendationId,
    isLoadingNextBatch,
    showNextBatchCta,
    openOptimizationPanel,
    closeOptimizationPanel,
    collapseOptimization,
    expandOptimization,
    retryOptimization,
    refreshOptimization,
    markOptimizationItemComplete,
    loadNextOptimizationBatch,
  };
};
