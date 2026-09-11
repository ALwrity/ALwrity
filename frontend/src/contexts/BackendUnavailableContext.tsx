import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  setGlobalBackendUnavailableHandler,
  setGlobalBackendRecoveredHandler,
  getBackendCooldownSecondsRemaining,
  isBackendCooldownActive,
} from '../api/client';
import BackendUnavailableModal from '../components/BackendUnavailableModal';

interface BackendUnavailableContextValue {
  open: boolean;
  reason: string | null;
  retrySeconds: number;
  dismiss: () => void;
}

const BackendUnavailableContext = createContext<BackendUnavailableContextValue | undefined>(undefined);

/** After dismissing, stay quiet for this long before re-showing for a new outage. */
const SNOOZE_MS = 5 * 60 * 1000;

export const BackendUnavailableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const snoozeUntilRef = useRef(0);

  const dismiss = useCallback(() => {
    snoozeUntilRef.current = Date.now() + SNOOZE_MS;
    setOpen(false);
  }, []);

  // Live countdown while visible; auto-close when the cooldown fully clears
  // (backend answered) without waiting for a fresh recover notification.
  useEffect(() => {
    if (!open) return;
    setRetrySeconds(getBackendCooldownSecondsRemaining());
    const id = window.setInterval(() => {
      const remaining = getBackendCooldownSecondsRemaining();
      setRetrySeconds(remaining);
      if (remaining <= 0 && !isBackendCooldownActive()) {
        setOpen(false);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Register once; deliberately never unregister — outages must still surface
  // during React transitions (same contract as the subscription handler).
  useEffect(() => {
    setGlobalBackendUnavailableHandler(({ reason: r, retrySeconds: s }) => {
      if (Date.now() < snoozeUntilRef.current) return;
      setReason(r);
      setRetrySeconds(s);
      setOpen(true);
    });
    setGlobalBackendRecoveredHandler(() => {
      snoozeUntilRef.current = 0; // genuine recovery overrides any snooze
      setOpen(false);
      setReason(null);
      setRetrySeconds(0);
    });
  }, []);

  return (
    <BackendUnavailableContext.Provider value={{ open, reason, retrySeconds, dismiss }}>
      {children}
      <BackendUnavailableModal open={open} reason={reason} retrySeconds={retrySeconds} onClose={dismiss} />
    </BackendUnavailableContext.Provider>
  );
};

export const useBackendUnavailable = (): BackendUnavailableContextValue => {
  const ctx = useContext(BackendUnavailableContext);
  if (!ctx) {
    throw new Error('useBackendUnavailable must be used within a BackendUnavailableProvider');
  }
  return ctx;
};

export default BackendUnavailableContext;