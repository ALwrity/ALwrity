import { useState, useEffect, useRef } from 'react';

interface UseModalVisibilityProps {
  mediumPolling: { isPolling: boolean; currentStatus: string };
  rewritePolling: { isPolling: boolean; currentStatus: string };
  outlinePolling: { isPolling: boolean; currentStatus: string };
}

export const useModalVisibility = ({
  mediumPolling,
  rewritePolling,
  outlinePolling,
}: UseModalVisibilityProps) => {
  const [showModal, setShowModal] = useState(false);
  const [modalStartTime, setModalStartTime] = useState<number | null>(null);
  const [isMediumGenerationStarting, setIsMediumGenerationStarting] = useState(false);
  const [showOutlineModal, setShowOutlineModal] = useState(false);

  // Add minimum display time for modal
  const contentHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ((mediumPolling.isPolling || rewritePolling.isPolling || isMediumGenerationStarting) && !showModal) {
      setShowModal(true);
      setModalStartTime(Date.now());
    } else if (!mediumPolling.isPolling && !rewritePolling.isPolling && !isMediumGenerationStarting && showModal && (mediumPolling.currentStatus !== 'idle' || rewritePolling.currentStatus !== 'idle')) {
      const elapsed = Date.now() - (modalStartTime || 0);
      const minDisplayTime = 2000; // 2 seconds minimum
      
      if (elapsed < minDisplayTime) {
        contentHideTimeoutRef.current = setTimeout(() => {
          setShowModal(false);
          setModalStartTime(null);
          contentHideTimeoutRef.current = null;
        }, minDisplayTime - elapsed);
      } else {
        setShowModal(false);
        setModalStartTime(null);
      }
    }
    return () => {
      if (contentHideTimeoutRef.current) {
        clearTimeout(contentHideTimeoutRef.current);
        contentHideTimeoutRef.current = null;
      }
    };
  }, [mediumPolling.isPolling, rewritePolling.isPolling, isMediumGenerationStarting, showModal, modalStartTime, mediumPolling.currentStatus, rewritePolling.currentStatus]);

  // Handle outline modal visibility with proper timeout cleanup
  // Only auto-hide when polling has actually completed (currentStatus !== 'idle'),
  // NOT when modal was shown before polling started (the onModalShow → startPolling gap)
  const outlineHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (outlinePolling.isPolling && !showOutlineModal) {
      setShowOutlineModal(true);
    } else if (!outlinePolling.isPolling && showOutlineModal && outlinePolling.currentStatus !== 'idle') {
      outlineHideRef.current = setTimeout(() => {
        setShowOutlineModal(false);
        outlineHideRef.current = null;
      }, 1000);
    }
    return () => {
      if (outlineHideRef.current) {
        clearTimeout(outlineHideRef.current);
        outlineHideRef.current = null;
      }
    };
  }, [outlinePolling.isPolling, showOutlineModal, outlinePolling.currentStatus]);

  return {
    showModal,
    setShowModal,
    showOutlineModal,
    setShowOutlineModal,
    isMediumGenerationStarting,
    setIsMediumGenerationStarting,
  };
};

