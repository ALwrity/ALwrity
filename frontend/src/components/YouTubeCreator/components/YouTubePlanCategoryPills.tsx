/**
 * Plan Your Video Hub pills for Kids / Explainer category.
 */

import React from "react";
import { InputLabel, Stack } from "@mui/material";
import { labelSx } from "../styles";
import { YouTubePlanHubAction } from "./YouTubePlanHubAction";
import {
  YOUTUBE_PLAN_CATEGORY_PILLS,
  type YouTubePlanCategory,
} from "./youtubePlanCategory";
import { YOUTUBE_PLAN_HUB_TOOLTIPS } from "./youtubePlanHubTooltips";

export interface YouTubePlanCategoryPillsProps {
  planCategory: YouTubePlanCategory;
  disabled?: boolean;
  onPlanCategoryChange: (category: YouTubePlanCategory) => void;
}

export const YouTubePlanCategoryPills: React.FC<YouTubePlanCategoryPillsProps> = ({
  planCategory,
  disabled = false,
  onPlanCategoryChange,
}) => {
  const handleClick = (next: Exclude<YouTubePlanCategory, "">) => {
    try {
      const value: YouTubePlanCategory = planCategory === next ? "" : next;
      console.info("[YouTubePlan] Category pill clicked", { planCategory: value });
      onPlanCategoryChange(value);
    } catch (error) {
      console.error("[YouTubePlan] Category update failed", { planCategory: next, error });
    }
  };

  return (
    <>
      <InputLabel sx={{ ...labelSx, mb: 0.75 }}>Video category</InputLabel>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {YOUTUBE_PLAN_CATEGORY_PILLS.map((pill) => (
          <YouTubePlanHubAction
            key={pill.value}
            disabled={disabled}
            selected={planCategory === pill.value}
            tooltipAbove
            tooltip={
              pill.value === "kids"
                ? YOUTUBE_PLAN_HUB_TOOLTIPS.categoryKids
                : YOUTUBE_PLAN_HUB_TOOLTIPS.categoryExplainer
            }
            tipId={`yt-plan-hub-tip-category-${pill.value}`}
            onClick={() => handleClick(pill.value)}
          >
            {pill.label}
          </YouTubePlanHubAction>
        ))}
      </Stack>
    </>
  );
};
