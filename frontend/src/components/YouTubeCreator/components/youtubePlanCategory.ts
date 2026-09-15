/**
 * Plan Your Video category packs — Kids / Explainer fill producer fields.
 */

import type { VideoType } from "../constants";

export type YouTubePlanCategory = "kids" | "explainer" | "";

export interface YouTubePlanDetailsFieldsState {
  videoType: VideoType | "";
  targetAudience: string;
  videoGoal: string;
  brandStyle: string;
}

export interface YouTubePlanDetailsTouched {
  videoType: boolean;
  targetAudience: boolean;
  videoGoal: boolean;
  brandStyle: boolean;
}

export const EMPTY_YOUTUBE_PLAN_DETAILS_TOUCHED: YouTubePlanDetailsTouched = {
  videoType: false,
  targetAudience: false,
  videoGoal: false,
  brandStyle: false,
};

export const YOUTUBE_PLAN_CATEGORY_PACKS: Record<
  Exclude<YouTubePlanCategory, "">,
  YouTubePlanDetailsFieldsState
> = {
  kids: {
    videoType: "storytelling",
    targetAudience: "kids_and_families",
    videoGoal: "educate",
    brandStyle: "playful_fun",
  },
  explainer: {
    videoType: "educational",
    targetAudience: "students",
    videoGoal: "educate",
    brandStyle: "modern_minimalist",
  },
};

export const YOUTUBE_PLAN_CATEGORY_PILLS: Array<{
  value: Exclude<YouTubePlanCategory, "">;
  label: string;
}> = [
  { value: "kids", label: "Kids" },
  { value: "explainer", label: "Explainer" },
];

export function parseYouTubePlanCategory(value: unknown): YouTubePlanCategory {
  if (value == null || String(value).trim() === "") {
    return "";
  }
  if (value === "kids" || value === "explainer") {
    return value;
  }
  console.warn("[YouTubePlan] Category unknown; leaving unset", { requested: value });
  return "";
}

export function parseYouTubePlanDetailsTouched(value: unknown): YouTubePlanDetailsTouched {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_YOUTUBE_PLAN_DETAILS_TOUCHED };
  }
  const raw = value as Record<string, unknown>;
  return {
    videoType: raw.videoType === true,
    targetAudience: raw.targetAudience === true,
    videoGoal: raw.videoGoal === true,
    brandStyle: raw.brandStyle === true,
  };
}

export function applyYouTubePlanCategoryPack(args: {
  category: YouTubePlanCategory;
  current: YouTubePlanDetailsFieldsState;
  touched: YouTubePlanDetailsTouched;
}): YouTubePlanDetailsFieldsState & { planCategory: YouTubePlanCategory } {
  const planCategory = parseYouTubePlanCategory(args.category);
  const { current, touched } = args;
  if (!planCategory) {
    console.info("[YouTubePlan] Category cleared");
    return {
      planCategory: "",
      videoType: touched.videoType ? current.videoType : "",
      targetAudience: touched.targetAudience ? current.targetAudience : "",
      videoGoal: touched.videoGoal ? current.videoGoal : "",
      brandStyle: touched.brandStyle ? current.brandStyle : "",
    };
  }
  const pack = YOUTUBE_PLAN_CATEGORY_PACKS[planCategory];
  console.info("[YouTubePlan] Category applied", {
    planCategory,
    keptVideoType: touched.videoType,
    keptAudience: touched.targetAudience,
    keptGoal: touched.videoGoal,
    keptStyle: touched.brandStyle,
  });
  return {
    planCategory,
    videoType: touched.videoType ? current.videoType : pack.videoType,
    targetAudience: touched.targetAudience ? current.targetAudience : pack.targetAudience,
    videoGoal: touched.videoGoal ? current.videoGoal : pack.videoGoal,
    brandStyle: touched.brandStyle ? current.brandStyle : pack.brandStyle,
  };
}
