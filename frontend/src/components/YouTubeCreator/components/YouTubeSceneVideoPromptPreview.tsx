/**
 * Preview of the full WAN 2.5 request that will be sent for a YouTube scene video.
 */

import React from "react";
import { buildYoutubeSceneVideoPromptPreview } from "../utils/buildYoutubeSceneVideoPromptPreview";
import { YouTubeSceneVideoRequestDetails } from "./YouTubeSceneVideoRequestDetails";
import type { Scene } from "../../../services/youtubeApi";

interface YouTubeSceneVideoPromptPreviewProps {
  scene: Scene;
  resolution?: string;
}

export const YouTubeSceneVideoPromptPreview: React.FC<YouTubeSceneVideoPromptPreviewProps> = ({
  scene,
  resolution,
}) => {
  const preview = buildYoutubeSceneVideoPromptPreview(scene);

  return (
    <YouTubeSceneVideoRequestDetails
      details={{
        visualPrompt: preview.visualPrompt,
        promptSource: preview.promptSource,
        generationMode: preview.generationMode,
        duration: preview.duration,
        durationEstimate: preview.durationEstimate,
        enablePromptExpansion: preview.enablePromptExpansion,
        hasSystemPrompt: preview.hasSystemPrompt,
        imageAttached: preview.imageAttached,
        audioAttached: preview.audioAttached,
        imageUrl: preview.imageUrl,
        audioUrl: preview.audioUrl,
        audioNote: preview.audioNote,
        gateway: "wavespeed_wan25",
        provider: "wavespeed",
        model: preview.generationMode === "i2v" ? "alibaba/wan-2.5/image-to-video" : "alibaba/wan-2.5/text-to-video",
        resolution,
        negativePromptSent: false,
        seedSent: false,
      }}
    />
  );
};
