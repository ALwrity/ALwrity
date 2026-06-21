import { useCallback, useState } from 'react';

import {
  getLinkedInProfile,
  type LinkedInProfileOptimizationDebug,
} from '../api/linkedinSocial';

const LOG_PREFIX = '[ProfileOptimization]';

export type ProfileOptimizationPanelState = 'idle' | 'open' | 'loading_gaps' | 'error';

/**
 * Step 1 shell — opens panel and loads rubric gap debug summary from backend.
 */
export function useLinkedInProfileOptimization(isProfileComplete: boolean) {
  const [panelState, setPanelState] = useState<ProfileOptimizationPanelState>('idle');
  const [optimizationDebug, setOptimizationDebug] =
    useState<LinkedInProfileOptimizationDebug | null>(null);
  const [optimizationDebugError, setOptimizationDebugError] = useState<string | null>(null);

  const openOptimizationPanel = useCallback(async () => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} open blocked — profile incomplete`);
      return;
    }

    console.info(`${LOG_PREFIX} user opened profile optimization panel — loading rubric gaps`);
    setPanelState('loading_gaps');
    setOptimizationDebugError(null);

    try {
      const data = await getLinkedInProfile({ debugProfileOptimizationGaps: true });
      const debug = data.profile_optimization_debug ?? null;
      setOptimizationDebug(debug);
      setPanelState('open');
      console.info(`${LOG_PREFIX} rubric gaps loaded`, {
        detectedGapsCount: debug?.detected_gaps_count ?? 0,
        topRuleIds: debug?.rule_ids.slice(0, 3) ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile gap analysis';
      console.error(`${LOG_PREFIX} rubric gap load failed:`, message, err);
      setOptimizationDebugError(message);
      setPanelState('error');
    }
  }, [isProfileComplete]);

  const closeOptimizationPanel = useCallback(() => {
    console.info(`${LOG_PREFIX} user closed profile optimization panel`);
    setPanelState('idle');
    setOptimizationDebugError(null);
  }, []);

  const retryOptimizationDebug = useCallback(async () => {
    await openOptimizationPanel();
  }, [openOptimizationPanel]);

  return {
    optimizationPanelState: panelState,
    isOptimizationOpen: panelState === 'open' || panelState === 'loading_gaps',
    isOptimizationLoading: panelState === 'loading_gaps',
    isOptimizationDisabled: !isProfileComplete,
    optimizationDebug,
    optimizationDebugError,
    openOptimizationPanel,
    closeOptimizationPanel,
    retryOptimizationDebug,
  };
}
