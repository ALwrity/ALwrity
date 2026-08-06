import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";

const CONTENT_TYPE_LABELS: Record<LinkedInDraftContentType, string> = {
  post: "LinkedIn post",
  article: "LinkedIn article",
  carousel: "LinkedIn carousel",
  video_script: "LinkedIn video script",
};

export function engagementBoosterDraftLabel(
  contentType: LinkedInDraftContentType,
): string {
  return CONTENT_TYPE_LABELS[contentType] ?? "LinkedIn post";
}

export function engagementBoosterInputTitle(
  contentType: LinkedInDraftContentType,
): string {
  switch (contentType) {
    case "article":
      return "Your Article Draft";
    case "carousel":
      return "Your Carousel Draft";
    case "video_script":
      return "Your Video Script Draft";
    default:
      return "Your Post Draft";
  }
}

export const ENGAGEMENT_BOOSTER_INTRO =
  "AI rewrites your draft to maximise engagement — stronger hooks, clearer CTAs, better formatting. Shows a before/after score.";

export const SCORING_UNAVAILABLE_MSG =
  "Preview scores are temporarily unavailable. Your optimised draft is ready below.";

export const REVIEW_IN_EDITOR_TOAST =
  "Review highlighted changes in the editor — accept or discard when ready.";

export const PERSONA_CONTEXT_HINT =
  "Using your Studio persona (industry, tone, and audience) to tailor the rewrite.";
