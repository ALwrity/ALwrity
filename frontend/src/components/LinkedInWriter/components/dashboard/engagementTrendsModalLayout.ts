/**
 * Viewport-relative layout for the Engagement Trends modal.
 * Aligned with Quick Create Post modal canvas size.
 */
import type { CSSProperties } from "react";
import { POST_WEDGE_MODAL_SIZE } from "./wedgeModalLayout";

export const ENGAGEMENT_TRENDS_MODAL_SIZE = {
  width: POST_WEDGE_MODAL_SIZE.width,
  maxWidth: POST_WEDGE_MODAL_SIZE.maxWidth,
  maxHeight: POST_WEDGE_MODAL_SIZE.maxHeight,
} as const;

export const ENGAGEMENT_TRENDS_BODY_STYLE: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

/** @deprecated Prefer importing from engagementTrendsCopy.ts */
export { GROWTH_CONTRIBUTION_TOOLTIP } from "./engagementTrendsCopy";
