import { RECOMMENDED_WORKFLOW_CARD_ID, type YouTubeWorkflowCardId } from "./youtubeWorkflowConfig";

/** Plan wedge id — first step in the YouTube Studio radial workflow. */
export function isYouTubePlanWedge(cardId: YouTubeWorkflowCardId): boolean {
  return cardId === RECOMMENDED_WORKFLOW_CARD_ID;
}

/** ForeignObject label layout when the START HERE bookmark is shown on Plan. */
export const YOUTUBE_PLAN_WEDGE_LABEL_LAYOUT = {
  justifyContent: "flex-start" as const,
  padding: "29px 6px 4px",
  innerFlex: "1 1 auto" as const,
};

export const YOUTUBE_PLAN_WEDGE_DEFAULT_LABEL_LAYOUT = {
  justifyContent: "center" as const,
  padding: "4px 6px",
  innerFlex: undefined,
};

export function youtubePlanWedgeLabelLayout(isPlanWedge: boolean) {
  return isPlanWedge ? YOUTUBE_PLAN_WEDGE_LABEL_LAYOUT : YOUTUBE_PLAN_WEDGE_DEFAULT_LABEL_LAYOUT;
}
