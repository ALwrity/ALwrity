/**
 * Opens Full Creator modal when Hub is mounted and openYouTubeCreator fires,
 * or when a deep-link left a pending prefill (Blog / ?tab=creator).
 */
import { useCallback, useEffect, useState } from "react";
import {
  hasPendingOpenCreator,
  YT_OPEN_CREATOR_EVENT,
} from "./youtubeStudioEvents";

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

    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);

    if (hasPendingOpenCreator()) {
      openModal("pending-deep-link");
    }

    return () => window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
  }, [onCloseWedges]);

  const closeFullCreatorModal = useCallback(() => {
    setFullCreatorOpen(false);
  }, []);

  return { fullCreatorOpen, closeFullCreatorModal };
}
