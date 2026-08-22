/**
 * Pending Plan wedge drill-down when opening Plan from Video Creator (or deep-links).
 */
export type YouTubePlanDrillDownSub = "brainstorm" | "url-import" | "saved-ideas";

export interface YouTubePlanDrillDownDetail {
  sub?: YouTubePlanDrillDownSub;
  seed?: string;
}

let pendingPlanDrillDown: YouTubePlanDrillDownDetail | null = null;
const STORAGE_KEY = "yt_pending_plan_drill_down";

export function queueYouTubePlanDrillDown(detail: YouTubePlanDrillDownDetail): void {
  pendingPlanDrillDown = { ...detail };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch (err) {
    console.warn("[youtubePlanDrillDown] queue failed", err);
  }
  console.info("[youtubePlanDrillDown] Queued", detail);
}

export function peekYouTubePlanDrillDown(): YouTubePlanDrillDownDetail | null {
  if (pendingPlanDrillDown) return pendingPlanDrillDown;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as YouTubePlanDrillDownDetail;
  } catch (err) {
    console.warn("[youtubePlanDrillDown] peek failed", err);
    return null;
  }
}

export function consumeYouTubePlanDrillDown(): YouTubePlanDrillDownDetail | null {
  let next = pendingPlanDrillDown;
  pendingPlanDrillDown = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!next && raw) {
      next = JSON.parse(raw) as YouTubePlanDrillDownDetail;
    }
  } catch {
    /* ignore */
  }
  return next;
}
