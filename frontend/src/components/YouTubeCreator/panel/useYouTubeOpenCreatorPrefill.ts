import { useEffect } from "react";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";
import {
  YT_OPEN_CREATOR_EVENT,
  consumePendingOpenCreator,
  type YouTubeOpenCreatorDetail,
} from "./youtubeOpenCreatorEvents";

/**
 * Applies Blog/Studio deep-link prefill into the Video Creator pipeline.
 * Does not render Studio Hub UI.
 */
export function useYouTubeOpenCreatorPrefill(
  updateState: (updates: Partial<YouTubeCreatorState>) => void,
  setActiveStep: (step: number) => void,
): void {
  useEffect(() => {
    const applyDetail = (detail: YouTubeOpenCreatorDetail) => {
      const updates: Partial<YouTubeCreatorState> = {};
      if (typeof detail.userIdea === "string") {
        updates.userIdea = detail.userIdea;
      }
      if (
        detail.durationType === "shorts" ||
        detail.durationType === "medium" ||
        detail.durationType === "long"
      ) {
        updates.durationType = detail.durationType;
      }
      if (Object.keys(updates).length > 0) {
        updateState(updates);
      }
      const nextStep = typeof detail.step === "number" ? detail.step : 0;
      setActiveStep(nextStep);
      updateState({ activeStep: nextStep });
      if (detail.focusUrlImport) {
        window.setTimeout(() => {
          document
            .querySelector('[data-tour="yt-url-import"]')
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 250);
      }
      console.info("[YouTubeVideoCreatorPanel] Applied open-creator prefill", detail);
    };

    const pending = consumePendingOpenCreator();
    if (pending) applyDetail(pending);

    const onOpenCreator = (event: Event) => {
      const detail = (event as CustomEvent<YouTubeOpenCreatorDetail>).detail || {};
      applyDetail(detail);
    };
    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
    return () => window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
  }, [updateState, setActiveStep]);
}
