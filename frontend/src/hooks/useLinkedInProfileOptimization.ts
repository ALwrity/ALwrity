import { useCallback, useState } from 'react';

const LOG_PREFIX = '[ProfileOptimization]';

export type ProfileOptimizationPanelState = 'idle' | 'open';

/**
 * Step 0 shell — panel opens with placeholder until Step 5 wires live recommendations.
 */
export function useLinkedInProfileOptimization(isProfileComplete: boolean) {
  const [panelState, setPanelState] = useState<ProfileOptimizationPanelState>('idle');

  const openOptimizationPanel = useCallback(() => {
    if (!isProfileComplete) {
      console.warn(`${LOG_PREFIX} open blocked — profile incomplete`);
      return;
    }
    console.info(`${LOG_PREFIX} user opened profile optimization panel`);
    setPanelState('open');
  }, [isProfileComplete]);

  const closeOptimizationPanel = useCallback(() => {
    console.info(`${LOG_PREFIX} user closed profile optimization panel`);
    setPanelState('idle');
  }, []);

  return {
    optimizationPanelState: panelState,
    isOptimizationOpen: panelState === 'open',
    isOptimizationDisabled: !isProfileComplete,
    openOptimizationPanel,
    closeOptimizationPanel,
  };
}
