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
  aiGenerating: _aiGenerating, // no longer gates the deferred dispatch (isGeneratingRef owns concurrency)
  originalHandleCreateStrategy,
  setShowEnterpriseModal
}: UseModalManagementProps) => {
  const originalHandleCreateStrategyRef = useRef<(() => Promise<void>) | null>(null);
  // #9: guard the deferred (setTimeout) handlers — if the component unmounts /
  // navigates within the delay window, the create must NOT fire (would be a
  // setState-after-unmount + a "phantom" strategy generation).
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    // Re-arm on EVERY effect run — React StrictMode (dev) double-invokes
    // effects (mount → cleanup → re-mount); the cleanup must not poison the
    // ref permanently or every deferred Proceed is "after unmount" in dev.
    isMountedRef.current = true;
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
    // Phase QA (2026-09): breadcrumb every branch — the Proceed click going
    // silent (modal closes, generation never starts, no logs) was only
    // diagnosable from the missing hook logs. Also: the old double-gate
    // (!aiGenerating && handler) silently swallowed the click when the
    // captured aiGenerating went stale — the ActionButtons hook already
    // owns concurrency via isGeneratingRef, so this layer only checks the
    // handler's presence.
    devLog.log('⏭️ Enterprise modal: Proceed clicked');
    setShowEnterpriseModal(false);
    sessionStorage.removeItem('showEnterpriseModal'); // Clear sessionStorage

    // Wait for the dialog's close animation before proceeding.
    setTimeout(async () => {
      try {
        const handler = originalHandleCreateStrategyRef.current;
        if (!isMountedRef.current) {
          devLog.warn('⏭️ Proceed deferred fired after unmount — dropped');
          return;
        }
        if (!handler) {
          devLog.error('❌ Proceed: no creation handler wired to useModalManagement');
          return;
        }
        devLog.log(`▶️ Proceedings deferred (${MODAL_TRANSITION_DELAY_MS}ms) — invoking creation handler`);
        await handler();
        devLog.log('✅ Deferred creation handler returned');
      } catch (error) {
        devLog.error('Error in handleProceedWithCurrentStrategy:', error);
      }
    }, MODAL_TRANSITION_DELAY_MS);
  };

  // Handle add enterprise datapoints (coming soon)
  const handleAddEnterpriseDatapoints = async () => {
    devLog.log('⏱️ Enterprise modal: Add Enterprise Datapoints clicked');
    setShowEnterpriseModal(false);
    sessionStorage.removeItem('showEnterpriseModal'); // Clear sessionStorage

    // For now, just proceed with current strategy
    // In Phase 2, this will enable enterprise datapoints
    setTimeout(async () => {
      try {
        const handler = originalHandleCreateStrategyRef.current;
        if (!isMountedRef.current) {
          devLog.warn('⏭️ Datapoints deferred fired after unmount — dropped');
          return;
        }
        if (!handler) {
          devLog.error('❌ Datapoints: no creation handler wired to useModalManagement');
          return;
        }
        devLog.log('▶️ Datapoints deferred — invoking creation handler');
        await handler();
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

