/**
 * After generate: full WAN 2.5 request used for a YouTube scene video.
 */

import React, { useCallback, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { YouTubeSceneVideoGeneration } from "../../../services/youtubeApi";
import { YouTubeSceneVideoRequestDetails } from "./YouTubeSceneVideoRequestDetails";

interface YouTubeSceneVideoPromptMetaProps {
  generation?: YouTubeSceneVideoGeneration | null;
  defaultExpanded?: boolean;
}

function formatCopyPayload(generation: YouTubeSceneVideoGeneration): string {
  return [
    `gateway: ${generation.gateway || "wavespeed_wan25"}`,
    `provider: ${generation.provider || "wavespeed"}`,
    `model: ${generation.model || ""}`,
    `mode: ${generation.generation_mode || ""}`,
    `resolution: ${generation.resolution || ""}`,
    `clip_duration: ${generation.duration ?? ""}s`,
    `duration_estimate: ${generation.duration_estimate ?? ""}s`,
    `enable_prompt_expansion: ${Boolean(generation.enable_prompt_expansion)}`,
    `has_system_prompt: false`,
    `image_attached: ${Boolean(generation.image_attached)}`,
    `image_url: ${generation.image_url || ""}`,
    `audio_attached: ${Boolean(generation.audio_attached)}`,
    `audio_url: ${generation.audio_url || ""}`,
    `audio_note: ${generation.audio_note || ""}`,
    `prompt_source: ${generation.prompt_source || ""}`,
    `negative_prompt_sent: ${Boolean(generation.negative_prompt_sent)}`,
    `seed_sent: ${Boolean(generation.seed_sent)}`,
    "",
    "PROMPT",
    generation.visual_prompt || "",
  ].join("\n");
}

export const YouTubeSceneVideoPromptMeta: React.FC<YouTubeSceneVideoPromptMetaProps> = ({
  generation,
  defaultExpanded = false,
}) => {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!generation) {
      return;
    }
    try {
      await navigator.clipboard.writeText(formatCopyPayload(generation));
      setCopyMessage("Copied full request details");
    } catch (error) {
      console.error("[YouTubeSceneVideoPromptMeta] Copy failed", error);
      setCopyMessage("Could not copy. Select the text instead.");
    }
  }, [generation]);

  if (!generation) {
    return null;
  }

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        mt: 0.5,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600, color: "#111827", fontSize: "0.875rem" }}>
          Exact request sent for scene video
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.25}>
          <YouTubeSceneVideoRequestDetails
            details={{
              visualPrompt: generation.visual_prompt || "",
              promptSource: generation.prompt_source,
              generationMode: generation.generation_mode,
              duration: generation.duration,
              durationEstimate: generation.duration_estimate,
              enablePromptExpansion: generation.enable_prompt_expansion,
              hasSystemPrompt: generation.has_system_prompt,
              imageAttached: generation.image_attached,
              audioAttached: generation.audio_attached,
              imageUrl: generation.image_url,
              audioUrl: generation.audio_url,
              audioNote: generation.audio_note,
              gateway: generation.gateway,
              provider: generation.provider,
              model: generation.model,
              resolution: generation.resolution,
              negativePromptSent: generation.negative_prompt_sent,
              seedSent: generation.seed_sent,
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleCopy}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            Copy full request
          </Button>
          {copyMessage ? (
            <Typography variant="caption" sx={{ color: "#6b7280" }}>
              {copyMessage}
            </Typography>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
