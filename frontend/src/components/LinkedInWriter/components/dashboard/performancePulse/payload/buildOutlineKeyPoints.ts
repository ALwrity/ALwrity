import type { LinkedInPost } from "../../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "../types";
import type { PerformancePulseCreateMode } from "./types";
import {
  extractContentBullets,
  joinOutlineBullets,
  pushUniqueBullet,
} from "./sharedTextUtils";

function structureBulletsForFormat(
  contentType: PerformanceContentType,
  mode: PerformancePulseCreateMode,
): string[] {
  if (contentType === "article") {
    return mode === "repurpose"
      ? [
          "Strong headline that promises clear reader value",
          "Section outline covering the core insight",
          "Actionable takeaway and memorable conclusion",
        ]
      : [
          "New angle on the same theme with fresh examples",
          "Match the reference article depth and pacing",
          "Close with a question or CTA for engagement",
        ];
  }

  if (contentType === "carousel") {
    return mode === "repurpose"
      ? [
          "Slide 1: bold hook that stops the scroll",
          "Slides 2–4: one clear idea per slide",
          "Final slide: CTA or engagement question",
        ]
      : [
          "New carousel arc on the same theme",
          "Keep one idea per slide, scannable layout",
          "End with a question that invites saves or comments",
        ];
  }

  if (contentType === "video_script") {
    return mode === "repurpose"
      ? [
          "Opening hook in the first 3 seconds",
          "Scene beats with key talking points",
          "Close with a clear CTA or question",
        ]
      : [
          "New hook on the same theme as the reference",
          "Match the reference pacing and conversational tone",
          "End with a comment-driving question",
        ];
  }

  return mode === "repurpose"
    ? [
        "Fresh hook that leads into the core message",
        "Reframe the main insight for today's audience",
        "Close with an engagement-driving question",
      ]
    : [
        "New angle on the same theme",
        "Match the reference post's tone and pacing",
        "End with a question that invites comments",
      ];
}

/** Outline bullets for Quick Create — format- and mode-aware. */
export function buildPerformanceOutlineKeyPoints(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
  contentType: PerformanceContentType,
): string {
  const contentBullets = extractContentBullets(post);
  const structureBullets = structureBulletsForFormat(contentType, mode);
  const merged: string[] = [];

  for (const bullet of contentBullets) {
    pushUniqueBullet(merged, bullet);
    if (merged.length >= 2) break;
  }

  for (const bullet of structureBullets) {
    pushUniqueBullet(merged, bullet);
    if (merged.length >= 4) break;
  }

  if (merged.length === 0) {
    return joinOutlineBullets(structureBullets.slice(0, 3));
  }

  return joinOutlineBullets(merged);
}

/** @deprecated Use buildPerformanceOutlineKeyPoints — post-only alias. */
export function buildOutlineKeyPoints(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
): string {
  return buildPerformanceOutlineKeyPoints(post, mode, "post");
}
