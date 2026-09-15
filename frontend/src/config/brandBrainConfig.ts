/**
 * Feature flag for the Brand Brain dashboard (full-page view).
 *
 * Read once at module scope from ``VITE_BRAND_BRAIN_DASHBOARD_ENABLED`` with the
 * same discipline as the ``CALENDAR_SIF_CARD_ENABLED`` flag in
 * ``strategySifConfig.ts``: an explicit env override wins (kill switch / staged
 * rollout), and an unset var keeps the module default (ON, matching the backend
 * predicate in ``services/intelligence/brand_brain_features.py``). The falsy
 * set must stay in parity with that backend predicate.
 */

export const BRAND_BRAIN_DASHBOARD_ENABLED: boolean = (() => {
  const raw = String(
    import.meta.env.VITE_BRAND_BRAIN_DASHBOARD_ENABLED ?? "",
  )
    .trim()
    .toLowerCase();
  // Explicit env override wins (kill switch / staged rollout); unset keeps the
  // module default (on, matching the backend predicate).
  if (raw !== "") {
    return !["false", "0", "no", "off"].includes(raw);
  }
  return true;
})();

export function isBrandBrainDashboardEnabled(): boolean {
  return BRAND_BRAIN_DASHBOARD_ENABLED;
}