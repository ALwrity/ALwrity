/**
 * Opens Full Creator modal when Hub is mounted and openYouTubeCreator fires.
 * resumeYouTubeDraft routes through openYouTubeCreator (no tab switch).
 */
import { useCallback, useEffect, useState } from "react";
import { YT_OPEN_CREATOR_EVENT } from "./youtubeStudioEvents";

export function useYouTubeFullCreatorModalHost(onCloseWedges: () => void): {
  fullCreatorOpen: boolean;
  closeFullCreatorModal: () => void;
} {
  const [fullCreatorOpen, setFullCreatorOpen] = useState(false);

  useEffect(() => {
    const onOpenCreator = () => {
      onCloseWedges();
      setFullCreatorOpen(true);
      console.info("[useYouTubeFullCreatorModalHost] Opening Full Creator modal", {
        source: YT_OPEN_CREATOR_EVENT,
      });
    };

    window.addEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
    return () => window.removeEventListener(YT_OPEN_CREATOR_EVENT, onOpenCreator);
  }, [onCloseWedges]);

  const closeFullCreatorModal = useCallback(() => {
    setFullCreatorOpen(false);
  }, []);

  return { fullCreatorOpen, closeFullCreatorModal };
}
