import { useCallback, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import {
  computeYouTubeRadialLayout,
  youtubeHubCenterLeftCss,
  youtubeHubCenterYPx,
  type YouTubeRadialLayout,
} from "./youtubeRadialLayout";

interface UseYouTubeHeroLayoutMetricsOptions {
  isDesktop: boolean;
  heroStageRef: RefObject<HTMLDivElement | null>;
  heroContainerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
}

interface YouTubeHeroLayoutMetrics {
  layout: YouTubeRadialLayout;
  hubCenterLeft: string;
  hubCenterY: number;
  hubDiameter: number;
  hubAvatarSize: number;
}

/** Measures hero canvas/stage like LinkedInDashboardHero for radial positioning. */
export function useYouTubeHeroLayoutMetrics({
  isDesktop,
  heroStageRef,
  heroContainerRef,
  canvasRef,
}: UseYouTubeHeroLayoutMetricsOptions): YouTubeHeroLayoutMetrics {
  const [containerWidth, setContainerWidth] = useState(640);
  const [containerHeight, setContainerHeight] = useState(640);

  const readSize = useCallback(() => {
    const canvas = canvasRef.current;
    const hero = heroContainerRef.current;
    const stage = heroStageRef.current;
    if (!canvas || !hero) return;

    const width = canvas.clientWidth;
    const stageHeight = stage?.clientHeight ?? 0;
    const viewportStageFallback =
      typeof window !== "undefined" ? Math.max(window.innerHeight - 152, 520) : 640;
    const height =
      stageHeight > 0
        ? stageHeight
        : isDesktop
          ? viewportStageFallback
          : Math.max(hero.clientHeight, 400);

    if (width > 0) setContainerWidth(width);
    if (height > 0) setContainerHeight(height);

    if (process.env.NODE_ENV === "development" && stageHeight <= 0 && isDesktop) {
      console.warn("[YouTubeStudioHub] Hero stage height unavailable; using viewport fallback", {
        stageHeight,
        fallback: viewportStageFallback,
        width,
      });
    }
  }, [canvasRef, heroContainerRef, heroStageRef, isDesktop]);

  useLayoutEffect(() => {
    readSize();
    const canvas = canvasRef.current;
    const hero = heroContainerRef.current;
    const stage = heroStageRef.current;
    if (!canvas || !hero) return undefined;

    const ro = new ResizeObserver(readSize);
    ro.observe(canvas);
    ro.observe(hero);
    if (stage) ro.observe(stage);
    window.addEventListener("resize", readSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", readSize);
    };
  }, [readSize, canvasRef, heroContainerRef, heroStageRef]);

  const layout = useMemo(
    () =>
      computeYouTubeRadialLayout(containerWidth, {
        maxHeight: containerHeight,
        desktopViewport: isDesktop,
      }),
    [containerWidth, containerHeight, isDesktop],
  );
  const hubCenterLeft = youtubeHubCenterLeftCss(layout);
  const hubCenterY = youtubeHubCenterYPx(layout);
  const hubDiameter = layout.hubVisualR * 2;
  const hubAvatarSize = Math.min(120, Math.round(layout.hubVisualR * 1.38));

  return {
    layout,
    hubCenterLeft,
    hubCenterY,
    hubDiameter,
    hubAvatarSize,
  };
}
