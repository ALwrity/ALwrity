/**
 * Landing deep-link: legacy `?tab=creator` → Hub URL + queue Full Creator open.
 */
import { useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  hasPendingOpenCreator,
  queueYouTubeCreatorOpen,
  type YouTubeStudioTab,
} from "./youtubeStudioEvents";

/**
 * One-shot: URL `?tab=creator` normalizes to Hub and ensures a pending Full Creator open
 * (modal host opens it when Hub mounts).
 */
export function useYouTubeCreatorLandingDeepLink(
  setTab: (next: YouTubeStudioTab) => void,
): void {
  const [searchParams] = useSearchParams();
  const isLegacyCreatorTab = useRef(searchParams.get("tab") === "creator");
  const handled = useRef(false);

  useLayoutEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (!isLegacyCreatorTab.current) {
      return;
    }

    setTab("hub");

    if (!hasPendingOpenCreator()) {
      queueYouTubeCreatorOpen({ step: 0 });
    }

    console.info(
      "[useYouTubeCreatorLandingDeepLink] Legacy ?tab=creator → Hub + Full Creator modal",
    );
  }, [setTab]);
}
