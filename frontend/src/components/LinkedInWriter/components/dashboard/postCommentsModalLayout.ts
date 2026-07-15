/**
 * Viewport layout for the Post Comments nested modal (inside Engagement Trends).
 * Comments list gets most of the vertical space; reply composer stays compact.
 */
export const POST_COMMENTS_MODAL_SIZE = {
  width: '70vw',
  maxWidth: '70vw',
  height: '85vh',
  maxHeight: '85vh',
} as const;

/** Minimum height for the scrollable comments list so several cards are visible. */
export const POST_COMMENTS_LIST_MIN_HEIGHT = '42vh';

/** Above Engagement Trends modal (tier: modal). Re-exported from linkedInStudioZIndex. */
export { POST_COMMENTS_MODAL_Z_INDEX } from '../../utils/linkedInStudioZIndex';
