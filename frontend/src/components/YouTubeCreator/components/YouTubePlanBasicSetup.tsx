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
import { YouTubePlanHubAction } from "./YouTubePlanHubAction";
import { YouTubePlanCategoryPills } from "./YouTubePlanCategoryPills";
import { YOUTUBE_PLAN_HUB_TOOLTIPS } from "./youtubePlanHubTooltips";
import type { YouTubePlanCategory } from "./youtubePlanCategory";

export interface YouTubePlanBasicSetupProps {
  durationType: DurationType;
  language: YouTubeContentLanguage;
  aspectRatio: YouTubePlanAspect;
  planCategory?: YouTubePlanCategory;
  disabled?: boolean;
  onDurationChange: (duration: DurationType) => void;
  onLanguageChange: (language: YouTubeContentLanguage) => void;
  onAspectRatioChange: (aspect: YouTubePlanAspect) => void;
  onPlanCategoryChange?: (category: YouTubePlanCategory) => void;
}

export const YouTubePlanBasicSetup: React.FC<YouTubePlanBasicSetupProps> = ({
  durationType,
  language,
  aspectRatio,
  planCategory = "",
  disabled = false,
  onDurationChange,
  onLanguageChange,
  onAspectRatioChange,
  onPlanCategoryChange,
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

  const handleCategory = (next: YouTubePlanCategory) => {
    try {
      if (!onPlanCategoryChange) {
        console.error("[YouTubePlan] Category update failed: missing handler", {
          planCategory: next,
        });
        return;
      }
      onPlanCategoryChange(next);
    } catch (error) {
      console.error("[YouTubePlan] Category update failed", { planCategory: next, error });
    }
  };

  return (
    <YouTubePlanPaneCard
      step={2}
      title="Basic setup"
      subtitle="Set category, duration, language, and frame."
      ariaLabel="Basic setup"
    >
      <YouTubePlanCategoryPills
        planCategory={planCategory}
        disabled={disabled}
        onPlanCategoryChange={handleCategory}
      />

      <InputLabel sx={{ ...labelSx, mb: 0.75 }}>Video Duration</InputLabel>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 0.75 }}>
        {YOUTUBE_PLAN_DURATION_PILLS.map((pill) => (
          <YouTubePlanHubAction
            key={pill.value}
            disabled={disabled}
            selected={durationType === pill.value}
            tooltip={pill.hint}
            tipId={`yt-plan-hub-tip-duration-${pill.value}`}
            onClick={() => handleDuration(pill.value)}
          >
            {pill.label}
          </YouTubePlanHubAction>
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
          <YouTubePlanHubAction
            key={option.value}
            disabled={disabled}
            selected={aspectRatio === option.value}
            tooltip={
              option.value === "9:16"
                ? YOUTUBE_PLAN_HUB_TOOLTIPS.aspect916
                : YOUTUBE_PLAN_HUB_TOOLTIPS.aspect169
            }
            tipId={`yt-plan-hub-tip-aspect-${option.value}`}
            onClick={() => handleAspect(option.value)}
          >
            {option.label}
          </YouTubePlanHubAction>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: "#6b7280", display: "block" }}>
        Saved on this draft. Image and video generation still use today&apos;s provider sizes until a follow-up.
      </Typography>
    </YouTubePlanPaneCard>
  );
};
