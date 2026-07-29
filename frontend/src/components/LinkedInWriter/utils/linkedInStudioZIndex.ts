/**
 * LinkedIn Studio z-index tier map.
 *
 * Layer order (low → high):
 *   rail → modals → KC → tour → elevated
 *
 * CSS mirror: custom properties on `body.linkedin-dashboard-view` in alwrity-copilot.css.
 * Keep both files in sync when adding new overlays.
 */
export const LI_Z_RAIL = 5;
export const LI_Z_RAIL_MOBILE = 1190;
export const LI_Z_MOBILE_FAB = 1200;
export const LI_Z_MODAL = 11000;
export const LI_Z_KNOWLEDGE_CENTER = 12000;
export const LI_Z_TOUR = 13000;
export const LI_Z_ELEVATED_MODAL = 14000;

/** Post Comments nested modal — same tier as Knowledge Center popovers. */
export const POST_COMMENTS_MODAL_Z_INDEX = LI_Z_KNOWLEDGE_CENTER;

export const LINKEDIN_STUDIO_Z_INDEX_TIERS = {
  rail: LI_Z_RAIL,
  railMobile: LI_Z_RAIL_MOBILE,
  mobileFab: LI_Z_MOBILE_FAB,
  modal: LI_Z_MODAL,
  knowledgeCenter: LI_Z_KNOWLEDGE_CENTER,
  tour: LI_Z_TOUR,
  elevatedModal: LI_Z_ELEVATED_MODAL,
} as const;
