/**
 * Landing deep-link: legacy `?tab=creator` → Hub + queue Full Creator open.
 */
import { useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  hasPendingOpenCreator,
  queueYouTubeCreatorOpen,
  type YouTubeStudioTab,
} from "./youtubeStudioEvents";

/**
 * One-shot: URL `?tab=creator` becomes Hub and ensures a pending Full Creator open
 * (modal host opens it when Hub mounts). In-app tab clicks still work via setTab.
 */
export function useYouTubeCreatorLandingDeepLink(
  setTab: (next: YouTubeStudioTab) => void,
): { suppressCreatorTabForDeepLink: boolean } {
  const [searchParams] = useSearchParams();
  const coerceCreatorToHub = useRef(searchParams.get("tab") === "creator");
  const handled = useRef(false);

  useLayoutEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (!coerceCreatorToHub.current) {
      return;
    }

    coerceCreatorToHub.current = false;
    setTab("hub");

    if (!hasPendingOpenCreator()) {
      queueYouTubeCreatorOpen({ step: 0 });
    }

    console.info(
      "[useYouTubeCreatorLandingDeepLink] Legacy ?tab=creator → Hub + Full Creator modal",
    );
  }, [setTab]);

  return {
    /** True only on the first render of a ?tab=creator deep-link (avoids tab flash). */
    suppressCreatorTabForDeepLink: coerceCreatorToHub.current,
  };
}
