import { useEffect, useRef } from 'react';
import { devLog } from '../../../../../utils/devLogger';

// Phase F #28: the modal transition delay is now ONE documented constant
// instead of two arbitrary magic numbers (300ms/200ms). Rationale: enough
// time for the MUI dialog's closing animation to finish before the next
// action fires, so the transition doesn't stutter or look clipped.
const MODAL_TRANSITION_DELAY_MS = 300;

interface UseModalManagementProps {
  aiGenerating: boolean;
  originalHandleCreateStrategy?: (() => Promise<void>) | null;
  setShowEnterpriseModal: (show: boolean) => void;
}

export const useModalManagement = ({
  aiGenerating,
  originalHandleCreateStrategy,
  setShowEnterpriseModal
}: UseModalManagementProps) => {
  const originalHandleCreateStrategyRef = useRef<(() => Promise<void>) | null>(null);
  // #9: guard the deferred (setTimeout) handlers — if the component unmounts /
  // navigates within the delay window, the create must NOT fire (would be a
  // setState-after-unmount + a "phantom" strategy generation).
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update ref when originalHandleCreateStrategy changes
  useEffect(() => {
    if (originalHandleCreateStrategy) {
      originalHandleCreateStrategyRef.current = originalHandleCreateStrategy;
    }
  }, [originalHandleCreateStrategy]);

  // Phase F #27: the empty "Monitor aiGenerating for debugging" useEffect
  // (whose body was gutted long ago) is gone — dead effects still subscribe
  // to their deps on every render for nothing.

  // Handle proceed with current strategy (30 fields)
  const handleProceedWithCurrentStrategy = async () => {
    setShowEnterpriseModal(false);
    sessionStorage.removeItem('showEnterpriseModal'); // Clear sessionStorage

    // Wait for the dialog's close animation before proceeding.
    setTimeout(async () => {
      try {
        if (!isMountedRef.current) return;
        // Ensure we're not already generating
        if (!aiGenerating && originalHandleCreateStrategyRef.current) {
          await originalHandleCreateStrategyRef.current();
        }
      } catch (error) {
        devLog.error('Error in handleProceedWithCurrentStrategy:', error);
      }
    }, MODAL_TRANSITION_DELAY_MS);
  };

  // Handle add enterprise datapoints (coming soon)
  const handleAddEnterpriseDatapoints = async () => {
    setShowEnterpriseModal(false);
    sessionStorage.removeItem('showEnterpriseModal'); // Clear sessionStorage

    // For now, just proceed with current strategy
    // In Phase 2, this will enable enterprise datapoints
    setTimeout(async () => {
      try {
        if (!isMountedRef.current) return;
        // Ensure we're not already generating
        if (!aiGenerating && originalHandleCreateStrategyRef.current) {
          await originalHandleCreateStrategyRef.current();
        }
      } catch (error) {
        devLog.error('Error in handleAddEnterpriseDatapoints:', error);
      }
    }, MODAL_TRANSITION_DELAY_MS);
  };

  return {
    handleProceedWithCurrentStrategy,
    handleAddEnterpriseDatapoints
  };
};
