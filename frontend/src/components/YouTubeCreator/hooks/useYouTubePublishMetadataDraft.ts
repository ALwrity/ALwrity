/**
 * Render-step publish metadata: restore from the creator draft, keep user edits, persist changes.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Scene, VideoPlan } from "../../../services/youtubeApi";
import {
  buildYouTubePublishMetadata,
  reconcileYouTubePublishMetadata,
  type YouTubePublishMetadata,
} from "../components/youtubePublishMetadata";

interface UseYouTubePublishMetadataDraftParams {
  videoPlan: VideoPlan | null;
  scenes: Scene[];
  persistedPublishMetadata?: YouTubePublishMetadata | null;
  onPublishMetadataChange?: (next: YouTubePublishMetadata) => void;
}

export function useYouTubePublishMetadataDraft({
  videoPlan,
  scenes,
  persistedPublishMetadata,
  onPublishMetadataChange,
}: UseYouTubePublishMetadataDraftParams): {
  publishMetadata: YouTubePublishMetadata;
  setPublishMetadata: Dispatch<SetStateAction<YouTubePublishMetadata>>;
} {
  const derivedPublishMetadata = buildYouTubePublishMetadata(videoPlan, scenes);
  const previousDerivedPublishMetadataRef = useRef(derivedPublishMetadata);
  const persistRef = useRef(onPublishMetadataChange);
  persistRef.current = onPublishMetadataChange;

  const [publishMetadata, setPublishMetadata] = useState(
    () => persistedPublishMetadata ?? derivedPublishMetadata,
  );

  useEffect(() => {
    try {
      const previousDerived = previousDerivedPublishMetadataRef.current;
      setPublishMetadata((current) =>
        reconcileYouTubePublishMetadata(current, previousDerived, derivedPublishMetadata),
      );
      previousDerivedPublishMetadataRef.current = derivedPublishMetadata;
    } catch (error) {
      console.error("[useYouTubePublishMetadataDraft] Reconcile failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
    }
  }, [derivedPublishMetadata]);

  useEffect(() => {
    try {
      persistRef.current?.(publishMetadata);
    } catch (error) {
      console.error("[useYouTubePublishMetadataDraft] Persist failed", {
        errorName: error instanceof Error ? error.name : "Error",
        titleLength: publishMetadata.title.length,
        tagCount: publishMetadata.tags.length,
      });
    }
  }, [publishMetadata]);

  return { publishMetadata, setPublishMetadata };
}
