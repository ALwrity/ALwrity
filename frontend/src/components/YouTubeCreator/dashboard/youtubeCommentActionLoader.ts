/**
 * Per-action Comment Reply Assistant status copy.
 * Reuses typical-step percent from pitch generation. No live backend %.
 */

import { planGenerationProgressPercent } from "../utils/youtubePlanGenerationLoader";

export type YouTubeCommentProgressAction = "draft" | "send" | "save" | "delete";
export type YouTubeCommentParentBusyAction = Extract<
  YouTubeCommentProgressAction,
  "draft" | "send"
>;

export const YOUTUBE_COMMENT_DRAFT_LOADER_INTERVAL_MS = 4000;
export const YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS = 1200;

const TYPICAL_STEPS_DISCLAIMER =
  "The bar follows typical steps, not a live server percentage.";

type LoaderCopy = {
  title: string;
  messages: readonly string[];
  steps: string[];
  hint: string;
  intervalMs: number;
};

const COPY: Record<YouTubeCommentProgressAction, LoaderCopy> = {
  draft: {
    title: "Drafting reply",
    messages: [
      "Applying your channel voice...",
      "Reading the comment...",
      "Drafting the reply...",
      "Getting the draft ready to edit...",
    ],
    steps: [
      "Apply your channel voice",
      "Read the comment",
      "Draft the reply",
      "Ready to edit",
    ],
    hint: `This can take a little while. ${TYPICAL_STEPS_DISCLAIMER}`,
    intervalMs: YOUTUBE_COMMENT_DRAFT_LOADER_INTERVAL_MS,
  },
  send: {
    title: "Sending reply",
    messages: [
      "Checking your draft...",
      "Posting to YouTube...",
      "Confirming the reply...",
    ],
    steps: ["Check your draft", "Post to YouTube", "Confirm"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS,
  },
  save: {
    title: "Saving edit",
    messages: [
      "Keeping your edit...",
      "Updating on YouTube...",
      "Confirming the save...",
    ],
    steps: ["Keep your edit", "Update on YouTube", "Confirm"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS,
  },
  delete: {
    title: "Deleting reply",
    messages: [
      "Confirming delete...",
      "Removing on YouTube...",
      "Confirming removal...",
    ],
    steps: ["Confirm delete", "Remove on YouTube", "Confirm"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_COMMENT_API_LOADER_INTERVAL_MS,
  },
};

export function getYouTubeCommentActionLoaderCopy(
  action: YouTubeCommentProgressAction,
): LoaderCopy {
  return COPY[action];
}

export function youtubeCommentActionProgressPercent(
  loaderMessageIndex: number,
  messageCount: number,
): number {
  return planGenerationProgressPercent(loaderMessageIndex, messageCount);
}
