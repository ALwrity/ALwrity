/**
 * Display exact image or voice payload used for a YouTube scene asset.
 */

import React, { useCallback, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {
  YouTubeSceneAudioGeneration,
  YouTubeSceneImageGeneration,
} from "../../../services/youtubeApi";

interface YouTubeSceneAssetPromptMetaProps {
  kind: "image" | "audio";
  imageGeneration?: YouTubeSceneImageGeneration | null;
  audioGeneration?: YouTubeSceneAudioGeneration | null;
  defaultExpanded?: boolean;
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: "#f8fafc",
          borderRadius: 1,
          whiteSpace: "pre-wrap",
          fontSize: "0.8125rem",
          color: "#374151",
          fontFamily: "inherit",
          m: 0,
          maxHeight: 280,
          overflow: "auto",
        }}
      >
        {text || "(empty)"}
      </Box>
    </Box>
  );
}

export const YouTubeSceneAssetPromptMeta: React.FC<YouTubeSceneAssetPromptMetaProps> = ({
  kind,
  imageGeneration,
  audioGeneration,
  defaultExpanded = false,
}) => {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const generation = kind === "image" ? imageGeneration : audioGeneration;

  const handleCopy = useCallback(async () => {
    if (!generation) return;
    let payload = "";
    if (kind === "image" && imageGeneration?.image_prompt) {
      payload = imageGeneration.image_prompt;
    } else if (kind === "audio" && audioGeneration) {
      payload = [
        "INPUT TEXT",
        audioGeneration.input_text || "",
        "",
        "SPEECH TEXT",
        audioGeneration.speech_text || "",
      ].join("\n");
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopyMessage("Copied");
    } catch (error) {
      console.error("[YouTubeSceneAssetPromptMeta] Copy failed", error);
      setCopyMessage("Could not copy. Select the text instead.");
    }
  }, [audioGeneration, generation, imageGeneration, kind]);

  if (!generation) {
    return null;
  }

  const title =
    kind === "image"
      ? "Exact prompt sent for scene image"
      : "Exact text sent for scene voice";

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        mt: 1.5,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600, color: "#111827", fontSize: "0.875rem" }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.25}>
          {kind === "image" && imageGeneration ? (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Provider: ${imageGeneration.provider || "wavespeed"}`} />
                <Chip size="small" label={`Model: ${imageGeneration.model || "ideogram-v3-turbo"}`} />
                {imageGeneration.generation_type ? (
                  <Chip size="small" label={`Type: ${imageGeneration.generation_type}`} />
                ) : null}
                {imageGeneration.custom_prompt_used ? (
                  <Chip size="small" label="Custom prompt used" />
                ) : null}
              </Stack>
              <PromptBlock label="Image prompt" text={imageGeneration.image_prompt || ""} />
            </>
          ) : null}

          {kind === "audio" && audioGeneration ? (
            <>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Gateway: ${audioGeneration.gateway || "wavespeed_minimax_speech"}`} />
                <Chip size="small" label={`Voice: ${audioGeneration.voice_id || "auto"}`} />
                <Chip size="small" label={`Emotion: ${audioGeneration.emotion || "happy"}`} />
                {audioGeneration.language_boost ? (
                  <Chip size="small" label={`Language: ${audioGeneration.language_boost}`} />
                ) : null}
              </Stack>
              {audioGeneration.instructions_stripped ? (
                <Alert severity="info">
                  The server removed non-spoken markers like [Pacing: …] before sending text to
                  speech synthesis.
                </Alert>
              ) : null}
              <PromptBlock label="Input text (from client)" text={audioGeneration.input_text || ""} />
              <PromptBlock label="Speech text (sent to TTS)" text={audioGeneration.speech_text || ""} />
            </>
          ) : null}

          <Button
            variant="outlined"
            size="small"
            onClick={handleCopy}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            Copy prompt
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
