/**
 * Opens Full Creator modal when Hub is mounted and openYouTubeCreator fires,
 * or when a deep-link left a pending prefill (Blog / ?tab=creator).
 */
import { useCallback, useEffect, useState } from "react";
import {
  consumePendingOpenCreator,
  hasPendingOpenCreator,
  openYouTubePlanFromCreator,
  peekPendingOpenCreator,
  YT_CLOSE_CREATOR_EVENT,
  YT_OPEN_CREATOR_EVENT,
  type YouTubeOpenCreatorDetail,
} from "./youtubeStudioEvents";

function retargetDiscoveryPending(detail: YouTubeOpenCreatorDetail): boolean {
  if (!detail.focusUrlImport && !detail.focusBrainstorm && !detail.focusSavedIdeas) {
    return false;
  }
  const sub = detail.focusUrlImport
    ? "url-import"
    : detail.focusSavedIdeas
      ? "saved-ideas"
      : "brainstorm";
  openYouTubePlanFromCreator({
    sub,
    seed: typeof detail.userIdea === "string" ? detail.userIdea : undefined,
  });
  console.info("[useYouTubeFullCreatorModalHost] Retargeted discovery pending to Plan", {
    sub,
  });
  return true;
}

export function useYouTubeFullCreatorModalHost(onCloseWedges: () => void): {
  fullCreatorOpen: boolean;
  closeFullCreatorModal: () => void;
} {
  const [fullCreatorOpen, setFullCreatorOpen] = useState(false);

  useEffect(() => {
    const openModal = (source: string) => {
      onCloseWedges();
      setFullCreatorOpen(true);
      console.info("[useYouTubeFullCreatorModalHost] Opening Full Creator modal", {
        source,
      });
    };

    const onOpenCreator = () => openModal(YT_OPEN_CREATOR_EVENT);

    const onCloseCreator = () => {
      consumePendingOpenCreator();
      setFullCreatorOpen(false);
      console.info("[useYouTubeFullCreatorModalHost] Closed Full Creator modal", {
        source: YT_CLOSE_CREATOR_EVENT,
      });
    };

    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
    window.addEventListener(YT_CLOSE_CREATOR_EVENT, onCloseCreator);

    if (hasPendingOpenCreator()) {
      const pending = peekPendingOpenCreator();
      if (pending && retargetDiscoveryPending(pending)) {
        consumePendingOpenCreator();
      } else {
        openModal("pending-deep-link");
      }
    }

    return () => {
      window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
      window.removeEventListener(YT_CLOSE_CREATOR_EVENT, onCloseCreator);
    };
  }, [onCloseWedges]);

  const closeFullCreatorModal = useCallback(() => {
    consumePendingOpenCreator();
    setFullCreatorOpen(false);
  }, []);

  return { fullCreatorOpen, closeFullCreatorModal };
}
