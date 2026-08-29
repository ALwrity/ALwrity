/**
 * Studio Hub access control — landing wedges stay open; OAuth is enforced inside
 * sub-features (publish, analytics tiles, etc.) when data is required.
 */

const LEGACY_CONNECT_GATED_WEDGE_IDS = [
  "analysis",
  "engagement",
  "remarket",
] as const;

export type ConnectGatedWedgeId = (typeof LEGACY_CONNECT_GATED_WEDGE_IDS)[number];

/** Empty — hero wedges are never connect-gated on the landing page. */
export const CONNECT_GATED_WORKFLOW_IDS: readonly ConnectGatedWedgeId[] = [];

/** Hero wedges are always navigable from the radial / mobile grid. */
export function isWedgeConnectGated(_wedgeId: string, _connected: boolean): boolean {
  return false;
}

/** Plan modal tiles use their own coming-soon / notify flows — not OAuth gates. */
export function arePlanComingSoonTilesLocked(): boolean {
  return false;
}

/** Modal rail tiles are not blocked at the hub landing layer. */
export function isTileConnectGated(_connected: boolean): boolean {
  return false;
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
    });
  }
}
