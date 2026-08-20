/**
 * Shared Channel Bible modal chrome (size + back labels for Hub / Plan drill-down).
 */

import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

/** Same footprint as Plan wedge for every Hub workflow modal. */
export const YOUTUBE_WEDGE_MODAL_MAX_WIDTH = 1100;

export const YOUTUBE_BACK_TO_HUB_LABEL = "Studio Hub";

export type YouTubeModalShellProps = {
  maxWidth: number;
  onBack: () => void;
  backLabel: string;
};

export const YOUTUBE_WEDGE_BACK_LABELS: Record<YouTubeWorkflowCardId, string> = {
  plan: "Plan",
  create: "Create",
  publish: "Publish",
  analysis: "Analysis",
  engagement: "Engagement",
  remarket: "Remarket",
};

export function youtubeWedgeShellProps(onClose: () => void): YouTubeModalShellProps {
  return {
    maxWidth: YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
    onBack: onClose,
    backLabel: YOUTUBE_BACK_TO_HUB_LABEL,
  };
}

export function youtubeSubModalShellProps(
  parent: YouTubeWorkflowCardId,
  onBackToWedge: () => void,
): YouTubeModalShellProps {
  return {
    maxWidth: YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
    onBack: onBackToWedge,
    backLabel: YOUTUBE_WEDGE_BACK_LABELS[parent],
  };
}
