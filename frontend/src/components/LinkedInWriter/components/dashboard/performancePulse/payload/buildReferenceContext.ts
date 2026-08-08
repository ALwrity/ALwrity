import type { LinkedInPost } from "../../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "../types";
import type { PerformancePulseCreateMode } from "./types";

const REPURPOSE_INTENT: Record<PerformanceContentType, string> = {
  post:
    "Repurpose this winning post into fresh LinkedIn content. Preserve the core message and engagement patterns but use a new hook, wording, and structure. Do NOT copy verbatim.",
  article:
    "Repurpose this winning content into a fresh long-form LinkedIn article. Preserve the core insight and engagement patterns but use a new headline, section structure, and wording. Do NOT copy verbatim.",
  carousel:
    "Repurpose this winning content into a new LinkedIn carousel. Extract slide-worthy beats from the reference — one idea per slide — with a fresh hook and CTA. Do NOT copy verbatim.",
  video_script:
    "Repurpose this winning video post into a new LinkedIn video script. Turn the caption/message into a fresh hook, scene beats, and close. Do NOT copy the original script verbatim.",
};

const WRITE_MORE_INTENT: Record<PerformanceContentType, string> = {
  post:
    "Write more content like this reference post. Match tone, paragraph rhythm, and engagement style while exploring a new angle on the same theme. Do NOT copy verbatim.",
  article:
    "Write more long-form content like this reference article. Match depth, structure, and tone while exploring a new angle on the same theme. Do NOT copy verbatim.",
  carousel:
    "Write a new carousel like this reference. Match the scannable slide rhythm and engagement style with a new angle. Do NOT copy verbatim.",
  video_script:
    "Write a new video script inspired by this reference video post. Match hook style and pacing with a fresh angle. Do NOT copy verbatim.",
};

const REFERENCE_LABEL: Record<PerformanceContentType, string> = {
  post: "REFERENCE POST",
  article: "REFERENCE ARTICLE",
  carousel: "REFERENCE CAROUSEL POST",
  video_script: "REFERENCE VIDEO POST",
};

export function buildPerformanceReferenceContext(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
  contentType: PerformanceContentType,
): string {
  const original = post.text?.trim() ?? "";
  const intentMap = mode === "repurpose" ? REPURPOSE_INTENT : WRITE_MORE_INTENT;
  const intent = `CREATION INTENT: ${intentMap[contentType]}`;

  if (!original) return intent;
  return `${intent}\n\n${REFERENCE_LABEL[contentType]}:\n${original}`;
}

/** @deprecated Use buildPerformanceReferenceContext — post-only alias. */
export function buildReferenceContext(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
): string {
  return buildPerformanceReferenceContext(post, mode, "post");
}
