import { useState, useEffect } from 'react';

interface UseAutoPopulationProps {
  /** Cache-first per-session bootstrap (hydrate from persisted snapshot, generate on miss). */
  ensureStrategyFieldsForSession: () => Promise<void>;
  completionStats: any;
}

export const useAutoPopulation = ({
  ensureStrategyFieldsForSession,
  completionStats
}: UseAutoPopulationProps) => {
  const [autoPopulateAttempted, setAutoPopulateAttempted] = useState(false);

  // Bootstrap once per mount. The heavy work (snapshot hydrate / autofill)
  // is guarded inside the store action; this hook just fires it once.
  useEffect(() => {
    if (autoPopulateAttempted) {
      devLogSkip();
      return;
    }
    setAutoPopulateAttempted(true);
    devLogStart();
    void ensureStrategyFieldsForSession?.();
  }, [autoPopulateAttempted, ensureStrategyFieldsForSession]);

  return {
    autoPopulateAttempted,
    setAutoPopulateAttempted
  };
};

function devLogSkip(): void {
  console.log('⏸️ useAutoPopulation: Auto-population skipped (already attempted)');
}

function devLogStart(): void {
  console.log('🚀 useAutoPopulation: cache-first strategy bootstrapping started');
}
