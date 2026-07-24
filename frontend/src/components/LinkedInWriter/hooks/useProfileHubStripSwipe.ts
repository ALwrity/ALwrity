import { useCallback, useRef, useState } from "react";
import {
  clampProfileHubSwipeOffset,
  deriveProfileHubSwipeIntent,
  PROFILE_HUB_SWIPE_AXIS_LOCK_PX,
  resolveProfileHubSwipeAction,
  type ProfileHubSwipeContext,
} from "./profileHubStripSwipeUtils";

export {
  PROFILE_HUB_SWIPE_AXIS_LOCK_PX,
  PROFILE_HUB_SWIPE_MAX_OFFSET_PX,
  clampProfileHubSwipeOffset,
  deriveProfileHubAvatarShift,
  deriveProfileHubComboLayout,
  deriveProfileHubSwipeIntent,
  resolveProfileHubSwipeAction,
  type ProfileHubComboLayout,
  type ProfileHubSwipeAction,
  type ProfileHubSwipeIntent,
} from "./profileHubStripSwipeUtils";

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
  const axisLockedRef = useRef<"horizontal" | "vertical" | null>(null);
  const offsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
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

  const capturePointer = useCallback((target: HTMLElement, pointerId: number) => {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // setPointerCapture may fail if the pointer is already released
    }
  }, []);

  const releasePointer = useCallback((target: HTMLElement, pointerId: number) => {
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // ignore release errors
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (pointerIdRef.current !== null) return;
      pointerIdRef.current = event.pointerId;
      capturePointer(event.currentTarget, event.pointerId);
      startRef.current = { x: event.clientX, y: event.clientY };
      axisLockedRef.current = null;
      offsetRef.current = 0;
      setOffsetX(0);
    },
    [enabled, capturePointer],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || !startRef.current || pointerIdRef.current !== event.pointerId)
        return;

      const deltaX = event.clientX - startRef.current.x;
      const deltaY = event.clientY - startRef.current.y;

      if (!axisLockedRef.current) {
        if (
          Math.abs(deltaX) < PROFILE_HUB_SWIPE_AXIS_LOCK_PX &&
          Math.abs(deltaY) < PROFILE_HUB_SWIPE_AXIS_LOCK_PX
        ) {
          return;
        }
        axisLockedRef.current =
          Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      if (axisLockedRef.current !== "horizontal") return;

      event.preventDefault();
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
    ],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (pointerIdRef.current === event.pointerId) {
        releasePointer(event.currentTarget, event.pointerId);
        pointerIdRef.current = null;
      }

      if (!enabled) {
        resetSwipe();
        return;
      }

      const action = resolveProfileHubSwipeAction(
        offsetRef.current,
        swipeContext,
      );
      if (action === "connect") {
        suppressClickRef.current = true;
        onConnect?.();
      } else if (action === "disconnect") {
        suppressClickRef.current = true;
        onDisconnect?.();
      }

      resetSwipe();
    },
    [
      enabled,
      releasePointer,
      onConnect,
      onDisconnect,
      resetSwipe,
      swipeContext.connected,
      swipeContext.hasConnect,
      swipeContext.hasDisconnect,
      swipeContext.isConnecting,
      swipeContext.isDisconnecting,
    ],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (pointerIdRef.current === event.pointerId) {
        releasePointer(event.currentTarget, event.pointerId);
        pointerIdRef.current = null;
      }
      resetSwipe();
    },
    [releasePointer, resetSwipe],
  );

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
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    },
  };
}
