/**
 * Plan Your Video basic setup rail — duration, language, independent aspect.
 */

import React from "react";
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { DurationType, YouTubeContentLanguage } from "../constants";
import { YOUTUBE_CONTENT_LANGUAGE_OPTIONS } from "../constants";
import { helperSx, labelSx, selectMenuProps, selectSx } from "../styles";
import {
  YOUTUBE_PLAN_ASPECT_OPTIONS,
  YOUTUBE_PLAN_DURATION_PILLS,
  youtubePlanDurationHint,
  type YouTubePlanAspect,
} from "./youtubePlanAspect";
import { YouTubePlanPaneCard } from "./YouTubePlanPaneCard";

export interface YouTubePlanBasicSetupProps {
  durationType: DurationType;
  language: YouTubeContentLanguage;
  aspectRatio: YouTubePlanAspect;
  disabled?: boolean;
  onDurationChange: (duration: DurationType) => void;
  onLanguageChange: (language: YouTubeContentLanguage) => void;
  onAspectRatioChange: (aspect: YouTubePlanAspect) => void;
}

export const YouTubePlanBasicSetup: React.FC<YouTubePlanBasicSetupProps> = ({
  durationType,
  language,
  aspectRatio,
  disabled = false,
  onDurationChange,
  onLanguageChange,
  onAspectRatioChange,
}) => {
  const handleDuration = (next: DurationType) => {
    try {
      console.info("[YouTubePlan] Duration updated", { durationType: next });
      onDurationChange(next);
    } catch (error) {
      console.error("[YouTubePlan] Duration update failed", { durationType: next, error });
    }
  };

  const handleAspect = (next: YouTubePlanAspect) => {
    try {
      console.info("[YouTubePlan] Aspect ratio updated", { aspectRatio: next });
      onAspectRatioChange(next);
    } catch (error) {
      console.error("[YouTubePlan] Aspect ratio update failed", { aspectRatio: next, error });
    }
  };

  const handleLanguage = (next: YouTubeContentLanguage) => {
    try {
      onLanguageChange(next);
    } catch (error) {
      console.error("[YouTubePlan] Language update failed", { language: next, error });
    }
  };

  return (
    <YouTubePlanPaneCard
      step={2}
      title="Basic setup"
      subtitle="Set duration, language, and frame."
      ariaLabel="Basic setup"
    >
      <InputLabel sx={{ ...labelSx, mb: 0.75 }}>Video Duration</InputLabel>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 0.75 }}>
        {YOUTUBE_PLAN_DURATION_PILLS.map((pill) => (
          <button
            key={pill.value}
            type="button"
            disabled={disabled}
            className={
              durationType === pill.value ? "yt-plan-pill yt-plan-pill--selected" : "yt-plan-pill"
            }
            onClick={() => handleDuration(pill.value)}
          >
            {pill.label}
          </button>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 2 }}>
        {youtubePlanDurationHint(durationType)}
      </Typography>

      <InputLabel sx={{ ...labelSx, mb: 0.75 }}>Content Language</InputLabel>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <Select
          value={language}
          disabled={disabled}
          onChange={(event) => handleLanguage(event.target.value as YouTubeContentLanguage)}
          sx={selectSx}
          MenuProps={selectMenuProps}
        >
          {YOUTUBE_CONTENT_LANGUAGE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText sx={helperSx}>
          Pitch, script, and default audio use this language. Per-scene Audio Settings can still override the voice.
        </FormHelperText>
      </FormControl>

      <InputLabel sx={{ ...labelSx, mb: 0.75 }}>Aspect ratio</InputLabel>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 0.75 }}>
        {YOUTUBE_PLAN_ASPECT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            className={
              aspectRatio === option.value ? "yt-plan-pill yt-plan-pill--selected" : "yt-plan-pill"
            }
            onClick={() => handleAspect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: "#6b7280", display: "block" }}>
        Saved on this draft. Image and video generation still use today&apos;s provider sizes until a follow-up.
      </Typography>
    </YouTubePlanPaneCard>
  );
};
