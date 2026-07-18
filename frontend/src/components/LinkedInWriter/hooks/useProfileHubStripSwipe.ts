import { useCallback, useRef, useState } from 'react';
import {
  clampProfileHubSwipeOffset,
  deriveProfileHubSwipeIntent,
  PROFILE_HUB_SWIPE_AXIS_LOCK_PX,
  resolveProfileHubSwipeAction,
  type ProfileHubSwipeContext,
} from './profileHubStripSwipeUtils';

export {
  PROFILE_HUB_SWIPE_AXIS_LOCK_PX,
  PROFILE_HUB_SWIPE_MAX_OFFSET_PX,
  PROFILE_HUB_SWIPE_THRESHOLD_PX,
  clampProfileHubSwipeOffset,
  deriveProfileHubAvatarShift,
  deriveProfileHubComboLayout,
  deriveProfileHubSwipeIntent,
  resolveProfileHubSwipeAction,
  type ProfileHubComboLayout,
  type ProfileHubSwipeAction,
  type ProfileHubSwipeIntent,
} from './profileHubStripSwipeUtils';

interface UseProfileHubStripSwipeOptions {
  connected: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  enabled?: boolean;
}

export function useProfileHubStripSwipe({
  connected,
  onConnect,
  onDisconnect,
  isConnecting = false,
  isDisconnecting = false,
  enabled = true,
}: UseProfileHubStripSwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const offsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);

  const swipeContext: ProfileHubSwipeContext = {
    connected,
    hasConnect: Boolean(onConnect),
    hasDisconnect: Boolean(onDisconnect),
    isConnecting,
    isDisconnecting,
  };

  const resetSwipe = useCallback(() => {
    startRef.current = null;
    axisLockedRef.current = null;
    offsetRef.current = 0;
    setOffsetX(0);
  }, []);

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      axisLockedRef.current = null;
      offsetRef.current = 0;
      setOffsetX(0);
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (!enabled || !startRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;

      if (!axisLockedRef.current) {
        if (
          Math.abs(deltaX) < PROFILE_HUB_SWIPE_AXIS_LOCK_PX &&
          Math.abs(deltaY) < PROFILE_HUB_SWIPE_AXIS_LOCK_PX
        ) {
          return;
        }
        axisLockedRef.current =
          Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      }

      if (axisLockedRef.current !== 'horizontal') return;

      const clamped = clampProfileHubSwipeOffset(deltaX, swipeContext);
      offsetRef.current = clamped;
      setOffsetX(clamped);
    },
    [
      enabled,
      swipeContext.connected,
      swipeContext.hasConnect,
      swipeContext.hasDisconnect,
      swipeContext.isConnecting,
      swipeContext.isDisconnecting,
    ]
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled) {
      resetSwipe();
      return;
    }

    const action = resolveProfileHubSwipeAction(offsetRef.current, swipeContext);
    if (action === 'connect') {
      suppressClickRef.current = true;
      onConnect?.();
    } else if (action === 'disconnect') {
      suppressClickRef.current = true;
      onDisconnect?.();
    }

    resetSwipe();
  }, [
    enabled,
    onConnect,
    onDisconnect,
    resetSwipe,
    swipeContext.connected,
    swipeContext.hasConnect,
    swipeContext.hasDisconnect,
    swipeContext.isConnecting,
    swipeContext.isDisconnecting,
  ]);

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    offsetX,
    swipeIntent: deriveProfileHubSwipeIntent(offsetX),
    swipeHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: resetSwipe,
      onClickCapture,
    },
  };
}
