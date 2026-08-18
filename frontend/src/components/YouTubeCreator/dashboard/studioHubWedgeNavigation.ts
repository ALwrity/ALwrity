import { isWedgeConnectGated } from "./studioHubAccessConfig";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

export function shouldBlockWedgeNavigation(
  wedgeId: YouTubeWorkflowCardId,
  connected: boolean,
): boolean {
  return isWedgeConnectGated(wedgeId, connected);
}

export function resolveWedgeNavigation(
  wedgeId: YouTubeWorkflowCardId,
  connected: boolean,
  onOpenWedge: (id: YouTubeWorkflowCardId) => void,
  onConnectGate: () => void,
): void {
  if (shouldBlockWedgeNavigation(wedgeId, connected)) {
    onConnectGate();
    return;
  }
  onOpenWedge(wedgeId);
}
