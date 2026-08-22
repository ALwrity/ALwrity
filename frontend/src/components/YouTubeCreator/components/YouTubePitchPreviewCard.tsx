/**
 * Lightweight pitch preview (title, summary, hook, beats) plus optional history chips.
 */

import React from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";
import { YT_BORDER, YT_RED } from "../constants";
import { readableChipSx } from "../styles";

const selectedHistorySx = {
  ...readableChipSx,
  backgroundColor: YT_RED,
  borderColor: YT_RED,
  color: "#fff",
  "& .MuiChip-label": { color: "#fff" },
  "&:hover": {
    backgroundColor: YT_RED,
    borderColor: YT_RED,
    color: "#fff",
    "& .MuiChip-label": { color: "#fff" },
  },
};

export interface YouTubePitchPreviewCardProps {
  pitch: YouTubeVideoPitch;
  history?: YouTubeVideoPitch[];
  disabled?: boolean;
  onSelectHistoryPitch?: (pitch: YouTubeVideoPitch) => void;
}

export const YouTubePitchPreviewCard: React.FC<YouTubePitchPreviewCardProps> = ({
  pitch,
  history = [],
  disabled = false,
  onSelectHistoryPitch,
}) => {
  const beats = pitch.main_content_beats || [];
  const recent = history.slice(0, 3);

  return (
    <Paper
      elevation={0}
      sx={{ p: 2.5, border: `1px solid ${YT_BORDER}`, borderRadius: 2, bgcolor: "#fff" }}
    >
      <Stack spacing={2}>
        <Box>
          {pitch.creative_angle ? (
            <Chip label={pitch.creative_angle} size="small" sx={{ ...readableChipSx, mb: 1 }} />
          ) : null}
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
            {pitch.selected_title || "Untitled pitch"}
          </Typography>
        </Box>

        {pitch.video_summary ? (
          <Typography variant="body1" sx={{ color: "#374151", lineHeight: 1.65 }}>
            {pitch.video_summary}
          </Typography>
        ) : null}

        {pitch.hook_concept ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#0f172a", mb: 0.5 }}>
              Hook concept
            </Typography>
            <Typography variant="body2" sx={{ color: "#475569", lineHeight: 1.6 }}>
              {pitch.hook_concept}
            </Typography>
          </Box>
        ) : null}

        {beats.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#0f172a", mb: 1 }}>
              Main beats
            </Typography>
            <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 2.25 }}>
              {beats.map((beat, index) => (
                <Typography
                  key={`${pitch.id}-beat-${index}`}
                  component="li"
                  variant="body2"
                  sx={{ color: "#374151", lineHeight: 1.55 }}
                >
                  {beat}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {recent.length > 0 && onSelectHistoryPitch ? (
          <Box>
            <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 0.75 }}>
              Recent pitches (tap to compare)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {recent.map((item, index) => {
                const isActive = item.id === pitch.id;
                const label = item.selected_title
                  ? `${item.selected_title.slice(0, 42)}${item.selected_title.length > 42 ? "…" : ""}`
                  : `Pitch ${index + 1}`;
                return (
                  <Chip
                    key={item.id}
                    label={label}
                    size="small"
                    clickable
                    disabled={disabled}
                    onClick={() => {
                      console.info("[YouTubePitchPreviewCard] History pitch selected", {
                        pitchId: item.id,
                      });
                      onSelectHistoryPitch(item);
                    }}
                    sx={isActive ? selectedHistorySx : readableChipSx}
                  />
                );
              })}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};
