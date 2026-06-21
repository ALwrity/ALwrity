import { useCallback, useState } from 'react';

import {
  logProfileAnalysisError,
  runLinkedInProfileOptimization,
  type LinkedInProfileAnalysisError,
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

  const loadOptimization = useCallback(async (forceRegenerate = false) => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} load blocked — profile incomplete`);
      return;
    }

    console.info(`${LOG_PREFIX} loading profile optimization`, { forceRegenerate });
    setPanelState('loading');
    setOptimizationError(null);
    setOptimizationUserError(null);

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
            'We could not load profile suggestions right now.'
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
        setPanelState('no_gaps');
        console.info(`${LOG_PREFIX} no gaps — profile looks strong`);
        return;
      }

      if (!items || items.length === 0) {
        setOptimizationUserError('No profile suggestions were returned. Please try again.');
        setRecommendations(null);
        setOptimizationMeta(meta);
        setPanelState('error');
        return;
      }

      setRecommendations(items);
      setOptimizationMeta(meta);
      setPanelState('complete');
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

  const openOptimizationPanel = useCallback(async () => {
    await loadOptimization(false);
  }, [loadOptimization]);

  const closeOptimizationPanel = useCallback(() => {
    console.info(`${LOG_PREFIX} user closed profile optimization panel`);
    setPanelState('idle');
    setOptimizationUserError(null);
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
    openOptimizationPanel,
    closeOptimizationPanel,
    retryOptimization,
    refreshOptimization,
  };
}
