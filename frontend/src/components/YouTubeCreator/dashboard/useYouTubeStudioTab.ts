import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  openYouTubeCreator,
  parseYouTubeStudioTab,
  YT_SWITCH_TAB_EVENT,
  type YouTubeStudioTab,
} from "./youtubeStudioEvents";

/**
 * URL tab sync for Studio Hub. Hub-only shell: `creator` switch opens Full Creator modal.
 */
export function useYouTubeStudioTab(): {
  tab: YouTubeStudioTab;
  setTab: (next: YouTubeStudioTab) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseYouTubeStudioTab(searchParams.get("tab"));

  const setTab = useCallback(
    (next: YouTubeStudioTab) => {
      if (next === "creator") {
        openYouTubeCreator({ step: 0 });
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            params.set("tab", "hub");
            return params;
          },
          { replace: true },
        );
        return;
      }
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const next = (event as CustomEvent<{ tab?: YouTubeStudioTab }>).detail?.tab;
      if (next === "hub" || next === "creator") setTab(next);
    };
    window.addEventListener(YT_SWITCH_TAB_EVENT, onSwitch);
    return () => window.removeEventListener(YT_SWITCH_TAB_EVENT, onSwitch);
  }, [setTab]);

  return { tab, setTab };
}
