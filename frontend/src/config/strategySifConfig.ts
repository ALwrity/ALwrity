/**
 * Feature flags for the "Semantic Index" read-only status surfaces.
 *
 * Currently ON by default while we are in the testing/debug phase so the
 * surfaces can be exercised manually. Before shipping to production, gate
 * these behind a rollout flag again (the read path should be verified live
 * before fully exposing it). Each flag is looked up once at module scope so
 * tests can override it cleanly.
 *
 *  - STRATEGY_SIF_CARD_ENABLED       gates the "Semantic Dashboard" chip in the
 *    Content Planning Dashboard header (opens the Semantic Index card in a
 *    drawer). The card no longer renders on the Content Strategy tab.
 *  - STRATEGY_SIF_SNAPSHOT_ENABLED   gates the compact row on the Main Dashboard.
 *  - STRATEGY_SIF_EDUCATION_ENABLED  gates the "Learn how the index works"
 *    education dialog inside the card.
 */

export const STRATEGY_SIF_CARD_ENABLED: boolean = true;

export function isStrategySifCardEnabled(): boolean {
  return STRATEGY_SIF_CARD_ENABLED;
}

export const STRATEGY_SIF_SNAPSHOT_ENABLED: boolean = true;

export function isStrategySifSnapshotEnabled(): boolean {
  return STRATEGY_SIF_SNAPSHOT_ENABLED;
}

export const STRATEGY_SIF_EDUCATION_ENABLED: boolean = true;

export function isStrategySifEducationEnabled(): boolean {
  return STRATEGY_SIF_EDUCATION_ENABLED;
}

export const CALENDAR_SIF_CARD_ENABLED: boolean = (() => {
  const raw = String(
    import.meta.env.VITE_CALENDAR_SIF_CARD_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();
  // Explicit env override wins (kill switch / staged rollout); unset keeps
  // the module default (on, matching the current flagged rollout).
  if (raw !== "") {
    return !["false", "0", "no", "off"].includes(raw);
  }
  return true;
})();

export function isCalendarSifCardEnabled(): boolean {
  return CALENDAR_SIF_CARD_ENABLED;
}