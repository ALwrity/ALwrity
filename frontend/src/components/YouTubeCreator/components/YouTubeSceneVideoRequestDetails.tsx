/**
 * Shared display of the full WAN 2.5 request (text + attached files, not bytes).
 */

import React from "react";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";

export interface YouTubeSceneVideoRequestDetailsModel {
  visualPrompt: string;
  promptSource?: string;
  generationMode?: string;
  duration?: number;
  durationEstimate?: number | null;
  enablePromptExpansion?: boolean;
  hasSystemPrompt?: boolean;
  imageAttached?: boolean;
  audioAttached?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  audioNote?: string;
  gateway?: string;
  provider?: string;
  model?: string;
  resolution?: string;
  negativePromptSent?: boolean;
  seedSent?: boolean;
}

function FieldBlock({ label, text }: { label: string; text: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.25,
          bgcolor: "#f8fafc",
          borderRadius: 1,
          whiteSpace: "pre-wrap",
          fontSize: "0.8125rem",
          color: "#374151",
          fontFamily: "inherit",
          m: 0,
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        {text || "(none)"}
      </Box>
    </Box>
  );
}

export const YouTubeSceneVideoRequestDetails: React.FC<{
  details: YouTubeSceneVideoRequestDetailsModel;
}> = ({ details }) => {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Gateway: ${details.gateway || "wavespeed_wan25"}`} />
        {details.provider ? <Chip size="small" label={`Provider: ${details.provider}`} /> : null}
        {details.model ? <Chip size="small" label={`Model: ${details.model}`} /> : null}
        {details.generationMode ? (
          <Chip size="small" label={`Mode: ${details.generationMode}`} />
        ) : null}
        {details.resolution ? (
          <Chip size="small" label={`Resolution: ${details.resolution}`} />
        ) : null}
        {details.duration ? <Chip size="small" label={`Clip: ${details.duration}s`} /> : null}
        {details.enablePromptExpansion ? (
          <Chip size="small" label="WAN prompt expansion on" />
        ) : (
          <Chip size="small" label="WAN prompt expansion off" />
        )}
      </Stack>

      <Alert severity="info">
        WAN 2.5 is not a text LLM. There is no system prompt and no user prompt pair. The
        request is one visual `prompt` plus optional `image` and `audio` files.
      </Alert>

      <FieldBlock
        label="image (file attached as bytes, not written into the prompt)"
        text={
          details.imageAttached
            ? `Attached: yes\nPath: ${details.imageUrl || "(generated scene image)"}`
            : "Attached: no (text-to-video fallback)"
        }
      />
      <FieldBlock
        label="audio (file attached as bytes, not written into the prompt)"
        text={
          details.audioAttached
            ? `Attached: yes\nPath: ${details.audioUrl || "(generated scene voice)"}\n${details.audioNote || ""}`.trim()
            : "Attached: no"
        }
      />
      {details.durationEstimate != null ? (
        <Typography variant="caption" sx={{ color: "#6b7280" }}>
          Scene duration estimate: {details.durationEstimate}s → WAN clip {details.duration}s
          (only 5s or 10s is allowed).
        </Typography>
      ) : null}
      <FieldBlock
        label={`prompt (text field${details.promptSource ? `, from ${details.promptSource}` : ""})`}
        text={details.visualPrompt}
      />
      <FieldBlock
        label="Optional WAN fields not sent by YouTube Creator"
        text={`negative_prompt: ${details.negativePromptSent ? "sent" : "not sent"}\nseed: ${details.seedSent ? "sent" : "not sent"}`}
      />
    </Stack>
  );
};
