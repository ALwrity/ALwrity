import { useCallback, useEffect, useRef, useState } from "react";

export function useConnectLockedHint(locked: boolean) {
  const [hintVisible, setHintVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const revealHint = useCallback(() => {
    if (!locked) return;
    clearHideTimer();
    setHintVisible(true);
  }, [clearHideTimer, locked]);

  const concealHint = useCallback(() => {
    clearHideTimer();
    setHintVisible(false);
  }, [clearHideTimer]);

  const flashHint = useCallback(() => {
    if (!locked) return;
    revealHint();
    hideTimerRef.current = setTimeout(() => setHintVisible(false), 2800);
  }, [locked, revealHint]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return { hintVisible, revealHint, concealHint, flashHint };
}
