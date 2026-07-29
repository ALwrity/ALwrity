import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { RadialLayout } from "../components/dashboard/dashboardRadialLayout";
import {
  clearHubHeaderPersonaSync,
  syncHubHeaderPersona,
} from "../utils/syncHubHeaderPersona";

interface UseHubHeaderPersonaSyncOptions {
  canvasRef: React.RefObject<HTMLElement | null>;
  layout: RadialLayout;
  desktopViewport: boolean;
  /** Called when canvas/stage size changes (same triggers as hub axis). */
  deps?: unknown[];
}

/**
 * Keeps the nav Content Persona pill on the same vertical axis as the profile hub.
 * Runs layout-math sync immediately and re-measures after paint (avatar may mount later).
 */
export function useHubHeaderPersonaSync({
  canvasRef,
  layout,
  desktopViewport,
  deps = [],
}: UseHubHeaderPersonaSyncOptions): void {
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const runSync = useCallback(() => {
    if (!desktopViewport) {
      clearHubHeaderPersonaSync();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    syncHubHeaderPersona(canvas, layoutRef.current, true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        syncHubHeaderPersona(canvas, layoutRef.current, true);
      });
    });
  }, [canvasRef, desktopViewport]);

  useLayoutEffect(() => {
    runSync();
  }, [runSync, layout, desktopViewport, ...deps]);

  useEffect(() => {
    if (!desktopViewport) return undefined;

    const canvas = canvasRef.current;
    const headerRow = document.querySelector(".linkedin-writer-header-row");
    const heroStage = canvas?.closest(".linkedin-dashboard-hero-stage");
    const hubRoot = document.querySelector(".linkedin-dashboard-hero-hub");

    const ro = new ResizeObserver(() => runSync());
    if (canvas) ro.observe(canvas);
    if (heroStage) ro.observe(heroStage);
    if (headerRow) ro.observe(headerRow);

    const mo =
      hubRoot &&
      new MutationObserver(() => {
        window.requestAnimationFrame(() => runSync());
      });
    if (mo && hubRoot) {
      mo.observe(hubRoot, { childList: true, subtree: true, attributes: true });
    }

    const onViewportChange = () => {
      window.requestAnimationFrame(() => runSync());
    };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, { passive: true });

    const fontsReady =
      typeof document !== "undefined" && document.fonts?.ready
        ? document.fonts.ready.then(() => runSync())
        : undefined;

    return () => {
      ro.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange);
      void fontsReady;
      clearHubHeaderPersonaSync();
    };
  }, [canvasRef, desktopViewport, runSync]);
}
