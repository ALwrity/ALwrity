/**
 * Viewport layout for the Post Comments nested modal (inside Engagement Trends).
 * Aligned with Quick Create Post modal canvas size.
 */
import { POST_WEDGE_MODAL_SIZE } from "./wedgeModalLayout";

export const POST_COMMENTS_MODAL_SIZE = {
  width: POST_WEDGE_MODAL_SIZE.width,
  maxWidth: POST_WEDGE_MODAL_SIZE.maxWidth,
  height: POST_WEDGE_MODAL_SIZE.maxHeight,
  maxHeight: POST_WEDGE_MODAL_SIZE.maxHeight,
} as const;

/** Minimum height for the scrollable comments list so several cards are visible. */
export const POST_COMMENTS_LIST_MIN_HEIGHT = "min(42vh, 320px)";

/** Above Engagement Trends modal (tier: modal). Re-exported from linkedInStudioZIndex. */
export { POST_COMMENTS_MODAL_Z_INDEX } from "../../utils/linkedInStudioZIndex";
