import {
  isTileConnectGated,
  logOAuthSubModalOpen,
  type OAuthSubModalAction,
} from "./studioHubAccessConfig";

/** Run a tile action or request connect when production gates apply. */
export function resolveOAuthTileClick(
  connected: boolean,
  action: OAuthSubModalAction,
  onAction: () => void,
  onRequestConnect: () => void,
): void {
  if (isTileConnectGated(connected)) {
    onRequestConnect();
    return;
  }
  logOAuthSubModalOpen(action, connected);
  onAction();
}
