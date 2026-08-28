/**
 * Shared Studio Hub modal chrome for Channel Bible + wedge drill-downs.
 * Root wedges keep their own size and do not use Back-to-Hub from this helper.
 * Mirrors LinkedIn wedge modal UX with centered titles and consistent styling.
 */

import type { YouTubeModalHeaderLayout } from "./YouTubeActionModalHeader";
import type { YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

/** Plan-sized footprint for Channel Bible and wedge sub-modals. */
export const YOUTUBE_WEDGE_MODAL_MAX_WIDTH = 1100;

export const YOUTUBE_BACK_TO_HUB_LABEL = "Studio Hub";

export type YouTubeModalShellProps = {
  maxWidth: number;
  onBack: () => void;
  backLabel: string;
  titleSize?: "default" | "lg" | "xl";
  headerLayout?: YouTubeModalHeaderLayout;
};

export const YOUTUBE_WEDGE_BACK_LABELS: Record<YouTubeWorkflowCardId, string> = {
  plan: "Plan",
  create: "Create",
  publish: "Publish",
  analysis: "Analysis",
  engagement: "Engagement",
  remarket: "Remarket",
};

/** Hub-level Channel Bible (Back closes to Studio Hub). */
export function youtubeWedgeShellProps(onClose: () => void): YouTubeModalShellProps {
  return {
    maxWidth: YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
    onBack: onClose,
    backLabel: YOUTUBE_BACK_TO_HUB_LABEL,
    titleSize: "xl",
    headerLayout: "centeredRow",
  };
}

/** Sub-tool opened from a wedge (Back returns to that wedge). */
export function youtubeSubModalShellProps(
  parent: YouTubeWorkflowCardId,
  onBackToWedge: () => void,
): YouTubeModalShellProps {
  return {
    maxWidth: YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
    onBack: onBackToWedge,
    backLabel: YOUTUBE_WEDGE_BACK_LABELS[parent],
    titleSize: "xl",
    headerLayout: "centeredRow",
  };
}
