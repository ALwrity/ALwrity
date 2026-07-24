export const PROFILE_HUB_SWIPE_AXIS_LOCK_PX = 12;
export const PROFILE_HUB_SWIPE_MAX_OFFSET_PX = 96;

export type ProfileHubSwipeAction = "connect" | "disconnect";
export type ProfileHubSwipeIntent = ProfileHubSwipeAction | null;

export type ProfileHubComboLayout =
  "disconnected-rest" | "connect-swipe" | "connected-rest" | "disconnect-swipe";

export interface ProfileHubSwipeContext {
  connected: boolean;
  hasConnect: boolean;
  hasDisconnect: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
}

export function clampProfileHubSwipeOffset(
  deltaX: number,
  {
    connected,
    hasConnect,
    hasDisconnect,
    isConnecting,
    isDisconnecting,
  }: ProfileHubSwipeContext,
): number {
  const canSwipeRight = !connected && hasConnect && !isConnecting;
  const canSwipeLeft = connected && hasDisconnect && !isDisconnecting;

  if (deltaX > 0 && !canSwipeRight) return 0;
  if (deltaX < 0 && !canSwipeLeft) return 0;

  return Math.max(
    -PROFILE_HUB_SWIPE_MAX_OFFSET_PX,
    Math.min(PROFILE_HUB_SWIPE_MAX_OFFSET_PX, deltaX),
  );
}

export function deriveProfileHubSwipeIntent(
  offsetX: number,
): ProfileHubSwipeIntent {
  if (offsetX > PROFILE_HUB_SWIPE_AXIS_LOCK_PX) return "connect";
  if (offsetX < -PROFILE_HUB_SWIPE_AXIS_LOCK_PX) return "disconnect";
  return null;
}

export function deriveProfileHubComboLayout(
  connected: boolean,
  offsetX: number,
  swipeIntent: ProfileHubSwipeIntent | null = null,
): ProfileHubComboLayout {
  const intent = swipeIntent ?? deriveProfileHubSwipeIntent(offsetX);

  if (!connected) {
    if (offsetX > PROFILE_HUB_SWIPE_AXIS_LOCK_PX || intent === "connect") {
      return "connect-swipe";
    }
    return "disconnected-rest";
  }

  if (offsetX < -PROFILE_HUB_SWIPE_AXIS_LOCK_PX || intent === "disconnect") {
    return "disconnect-swipe";
  }

  return "connected-rest";
}

export function deriveProfileHubAvatarShift(
  offsetX: number,
  layout: ProfileHubComboLayout,
): number {
  if (layout === "connect-swipe") {
    return Math.max(0, offsetX);
  }
  if (layout === "disconnect-swipe") {
    return Math.min(0, offsetX);
  }
  return 0;
}

export function resolveProfileHubSwipeAction(
  offsetX: number,
  {
    connected,
    hasConnect,
    hasDisconnect,
    isConnecting,
    isDisconnecting,
  }: ProfileHubSwipeContext,
): ProfileHubSwipeAction | null {
  // Thresholds mirror the max avatar travel distance so the action fires
  // as the profile circle reaches the far side of the button.
  const connectThreshold = 74;
  const disconnectThreshold = 68;

  if (
    offsetX >= connectThreshold &&
    !connected &&
    hasConnect &&
    !isConnecting
  ) {
    return "connect";
  }
  if (
    offsetX <= -disconnectThreshold &&
    connected &&
    hasDisconnect &&
    !isDisconnecting
  ) {
    return "disconnect";
  }
  return null;
}
