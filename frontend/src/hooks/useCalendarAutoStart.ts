/**
 * Hook driving the strategy-activation → calendar auto-start behaviour.
 *
 * Phase 4: when the Calendar Generation Wizard is entered from a strategy
 * activation (`fromStrategyActivation` prop or router navigation state),
 * generation should start automatically once — unless the user opted out
 * via `autoGenerate: false` in the navigation state.
 *
 * The once-guard ensures re-renders never double-fire generation.
 */
import { useCallback, useRef, useState } from 'react';
import { shouldAutoStartCalendar } from '../utils/calendarAutoStart';

export interface UseCalendarAutoStartOptions {
  /** Prop from the wizard (orchestrator-driven flow). */
  fromStrategyActivation: boolean;
  /** Router `location.state` (link/navigation-driven flow). */
  locationState?: unknown;
  /** Strategy context prop; `strategyContext.strategyId` is preferred. */
  strategyContext?: { strategyId?: string | number } | null;
  /** Callback fired by `consumeAutoStart()` (guarded to fire once). */
  onAutoStart?: () => void;
  /** When true, consuming is blocked (generation already running). */
  isGenerating?: boolean;
}

export interface CalendarAutoStartState {
  shouldAutoStart: boolean;
  strategyId: string | number | null;
  consumeAutoStart: () => void;
  hasConsumed: boolean;
}

function extractStrategyId(
  locationState: unknown,
  strategyContext?: { strategyId?: string | number } | null
): string | number | null {
  if (strategyContext?.strategyId != null) {
    return strategyContext.strategyId;
  }
  if (locationState && typeof locationState === 'object') {
    const state = locationState as Record<string, unknown>;
    if (typeof state.strategyId === 'string' || typeof state.strategyId === 'number') {
      return state.strategyId;
    }
  }
  return null;
}

export function useCalendarAutoStart(options: UseCalendarAutoStartOptions): CalendarAutoStartState {
  const {
    fromStrategyActivation,
    locationState,
    strategyContext,
    onAutoStart,
    isGenerating = false,
  } = options;

  const consumedRef = useRef(false);
  const [hasConsumed, setHasConsumed] = useState(false);

  const state = (locationState && typeof locationState === 'object'
    ? (locationState as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  // An explicit opt-out in the navigation state wins over the prop.
  const optedOut = state.autoGenerate === false;

  const shouldAutoStart =
    !optedOut &&
    (shouldAutoStartCalendar(locationState) || fromStrategyActivation === true);

  const consumeAutoStart = useCallback(() => {
    if (consumedRef.current) return;
    if (!shouldAutoStart) return;
    if (isGenerating) return;
    consumedRef.current = true;
    setHasConsumed(true);
    onAutoStart?.();
  }, [shouldAutoStart, isGenerating, onAutoStart]);

  return {
    shouldAutoStart,
    strategyId: extractStrategyId(locationState, strategyContext),
    consumeAutoStart,
    hasConsumed,
  };
}

export default useCalendarAutoStart;
