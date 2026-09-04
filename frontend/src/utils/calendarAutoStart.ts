/**
 * Pure helpers for the strategy-activation → calendar auto-start flow.
 *
 * Phase 4: when a strategy is activated, the app navigates to the Calendar
 * tab with `fromStrategyActivation: true`. The CalendarTab consumes this
 * state to auto-start the 12-step calendar generation (opt-out via
 * `autoGenerate: false`).
 *
 * These are pure functions (no React, no router) so they are unit-testable
 * independently of components.
 */

export interface CalendarNavigationState {
  activeTab: number;
  fromStrategyActivation: boolean;
  autoGenerate: boolean;
  strategyId: string;
}

/** Calendar tab index inside ContentPlanningDashboard. */
export const CALENDAR_TAB_INDEX = 1;

/**
 * Decide whether the calendar generation should auto-start based on the
 * router navigation state. Defensive against malformed state.
 */
export function shouldAutoStartCalendar(
  locationState: unknown
): boolean {
  if (!locationState || typeof locationState !== 'object') {
    return false;
  }
  const state = locationState as Record<string, unknown>;
  if (state.fromStrategyActivation !== true) {
    return false;
  }
  // Explicit opt-out wins.
  if (state.autoGenerate === false) {
    return false;
  }
  return true;
}

/**
 * Build the navigation state used when a strategy activation should flow
 * into calendar generation.
 */
export function buildStrategyActivationNavigationState(
  strategyId: string,
  options: { autoGenerate?: boolean } = {}
): CalendarNavigationState {
  return {
    activeTab: CALENDAR_TAB_INDEX,
    fromStrategyActivation: true,
    autoGenerate: options.autoGenerate !== false,
    strategyId,
  };
}
