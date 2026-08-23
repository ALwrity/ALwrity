/**
 * Creative strategy angle chips + optional custom text (Plan Step).
 */

import React, { useEffect, useState } from "react";
import { Box, Chip, FormHelperText, InputLabel, Stack, TextField, Typography } from "@mui/material";
import { YT_RED } from "../constants";
import { helperSx, inputSx, labelSx, readableChipSx } from "../styles";

export const YOUTUBE_CREATIVE_ANGLE_PRESETS = [
  { label: "Contrarian", description: "Challenge the mainstream take with a smarter opposite angle." },
  { label: "Storytelling", description: "Lead with narrative, tension, and a personal or case-study arc." },
  { label: "Data / Analytics", description: "Lead with numbers, benchmarks, and evidence-backed insights." },
  { label: "Beginner Breakdown", description: "Explain simply for newcomers with step-by-step clarity." },
  { label: "How-To / Tutorial", description: "Actionable steps the viewer can follow immediately." },
  { label: "Humorous", description: "Entertaining hook with wit while still delivering value." },
] as const;

const selectedChipSx = {
  ...readableChipSx,
  backgroundColor: YT_RED,
  borderColor: YT_RED,
  color: "#fff",
  fontWeight: 600,
  "& .MuiChip-label": { color: "#fff" },
  "&:hover": {
    backgroundColor: YT_RED,
    borderColor: YT_RED,
    color: "#fff",
    "& .MuiChip-label": { color: "#fff" },
  },
};

function isPresetLabel(value: string): boolean {
  return YOUTUBE_CREATIVE_ANGLE_PRESETS.some((preset) => preset.label === value);
}

export interface YouTubeCreativeAngleSelectorProps {
  value: string;
  disabled?: boolean;
  onChange: (angle: string) => void;
}

export const YouTubeCreativeAngleSelector: React.FC<YouTubeCreativeAngleSelectorProps> = ({
  value,
  disabled = false,
  onChange,
}) => {
  const [customOpen, setCustomOpen] = useState(() => Boolean(value) && !isPresetLabel(value));
  const selectedPreset = YOUTUBE_CREATIVE_ANGLE_PRESETS.find((preset) => preset.label === value);

  useEffect(() => {
    if (isPresetLabel(value)) {
      setCustomOpen(false);
    }
  }, [value]);

  return (
    <Box>
      <InputLabel sx={labelSx} required>
        Creative strategy angle
      </InputLabel>
      <FormHelperText sx={{ ...helperSx, mt: 0, mb: 1 }}>
        Pick how this video should be framed. Required before generating a pitch.
      </FormHelperText>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: customOpen ? 1.5 : 0 }}>
        {YOUTUBE_CREATIVE_ANGLE_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            label={preset.label}
            clickable
            disabled={disabled}
            onClick={() => {
              console.info("[YouTubeCreativeAngleSelector] Preset selected", { angle: preset.label });
              setCustomOpen(false);
              onChange(preset.label);
            }}
            sx={selectedPreset?.label === preset.label && !customOpen ? selectedChipSx : readableChipSx}
          />
        ))}
        <Chip
          label="Custom"
          clickable
          disabled={disabled}
          onClick={() => {
            console.info("[YouTubeCreativeAngleSelector] Custom angle selected");
            setCustomOpen(true);
            if (isPresetLabel(value)) onChange("");
          }}
          sx={customOpen ? selectedChipSx : readableChipSx}
        />
      </Stack>
      {customOpen ? (
        <TextField
          fullWidth
          size="small"
          placeholder='e.g. "90s infomercial style" or "myth-busting expert"'
          value={isPresetLabel(value) ? "" : value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          inputProps={{ "aria-label": "Custom creative angle" }}
          sx={inputSx}
          helperText="Describe the creative lens for this pitch."
          FormHelperTextProps={{ sx: helperSx }}
        />
      ) : selectedPreset ? (
        <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mt: 1 }}>
          {selectedPreset.description}
        </Typography>
      ) : null}
    </Box>
  );
};
