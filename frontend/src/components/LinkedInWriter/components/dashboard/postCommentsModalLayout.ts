/**
 * Viewport layout for the Post Comments nested modal (inside Engagement Trends).
 * Comments list gets most of the vertical space; reply composer stays compact.
 */
export const POST_COMMENTS_MODAL_SIZE = {
  width: 'min(100vw - 24px, 70vw)',
  maxWidth: 'min(100vw - 24px, 720px)',
  height: 'min(85dvh, 85vh)',
  maxHeight: 'min(85dvh, 85vh)',
} as const;

/** Minimum height for the scrollable comments list so several cards are visible. */
export const POST_COMMENTS_LIST_MIN_HEIGHT = 'min(42vh, 320px)';

/** Above Engagement Trends modal (tier: modal). Re-exported from linkedInStudioZIndex. */
export { POST_COMMENTS_MODAL_Z_INDEX } from '../../utils/linkedInStudioZIndex';