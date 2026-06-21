import { useState, useEffect } from 'react';

interface UseAutoPopulationProps {
  autoPopulateFromOnboarding: () => void;
  completionStats: any;
}

export const useAutoPopulation = ({ 
  autoPopulateFromOnboarding, 
  completionStats
}: UseAutoPopulationProps) => {
  const [autoPopulateAttempted, setAutoPopulateAttempted] = useState(false);
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);

  // Auto-populate from onboarding on first load
  useEffect(() => {
    if (!autoPopulateAttempted && !isAutoPopulating) {
      console.log('🚀 useAutoPopulation: Triggering initial auto-population');
      console.log('📊 useAutoPopulation: Current completion stats:', {
        totalFields: completionStats?.total_fields || 0,
        filledFields: completionStats?.filled_fields || 0,
        completionPercentage: completionStats?.completion_percentage || 0
      });
      
      setIsAutoPopulating(true);
      autoPopulateFromOnboarding();
      setAutoPopulateAttempted(true);
      setIsAutoPopulating(false);
      
      console.log('✅ useAutoPopulation: Auto-population triggered successfully');
    } else {
      console.log('⏸️ useAutoPopulation: Auto-population skipped', {
        autoPopulateAttempted,
        isAutoPopulating
      });
    }
  }, [autoPopulateAttempted, isAutoPopulating, autoPopulateFromOnboarding, completionStats]);

  return {
    autoPopulateAttempted,
    setAutoPopulateAttempted
  };
}; 