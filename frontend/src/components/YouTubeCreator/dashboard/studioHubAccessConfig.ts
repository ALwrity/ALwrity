/**
 * Studio Hub access control — single source of truth for wedge/tile gates.
 * Flip STUDIO_HUB_UNLOCK_ALL_FOR_TESTING to false to restore production OAuth gates.
 */

/** When true, wedges and modal tiles skip connect / coming-soon UI gates. */
export const STUDIO_HUB_UNLOCK_ALL_FOR_TESTING = true;

const DEFAULT_CONNECT_GATED_WEDGE_IDS = [
  "analysis",
  "engagement",
  "remarket",
] as const;

export type ConnectGatedWedgeId = (typeof DEFAULT_CONNECT_GATED_WEDGE_IDS)[number];

/** Wedges that require YouTube OAuth when disconnected (empty while testing unlock is on). */
export const CONNECT_GATED_WORKFLOW_IDS: readonly ConnectGatedWedgeId[] =
  STUDIO_HUB_UNLOCK_ALL_FOR_TESTING ? [] : DEFAULT_CONNECT_GATED_WEDGE_IDS;

export function isStudioHubTestingUnlockEnabled(): boolean {
  return STUDIO_HUB_UNLOCK_ALL_FOR_TESTING;
}

export function isWedgeConnectGated(wedgeId: string, connected: boolean): boolean {
  if (STUDIO_HUB_UNLOCK_ALL_FOR_TESTING) return false;
  return (
    !connected &&
    (DEFAULT_CONNECT_GATED_WEDGE_IDS as readonly string[]).includes(wedgeId)
  );
}

/** True when Plan wedge tiles should show coming-soon / notify flow. */
export function arePlanComingSoonTilesLocked(): boolean {
  return !STUDIO_HUB_UNLOCK_ALL_FOR_TESTING;
}

/** True when a modal tile should route to connect instead of its action. */
export function isTileConnectGated(connected: boolean): boolean {
  return !STUDIO_HUB_UNLOCK_ALL_FOR_TESTING && !connected;
}

export const OAUTH_SUB_MODAL_ACTIONS = [
  "channel_pulse",
  "video_performance",
  "retention",
  "comment_assistant",
  "engage_queue",
  "stale_refresh",
  "schedule_publish",
  "playlist_attach",
  "publish_to_youtube",
] as const;

export type OAuthSubModalAction = (typeof OAUTH_SUB_MODAL_ACTIONS)[number];

/** Debug log when opening a sub-modal that typically needs OAuth (no mock data). */
export function logOAuthSubModalOpen(
  action: OAuthSubModalAction,
  connected: boolean,
): void {
  if (!connected) {
    console.info("[StudioHub] Opening OAuth-backed sub-modal while disconnected", {
      action,
      testingUnlock: STUDIO_HUB_UNLOCK_ALL_FOR_TESTING,
    });
  }
}
