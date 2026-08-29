/**
 * YouTube Studio overlay contract (Phase 4 — Hub isolation strategy).
 *
 * Problem 1 (fixed in Phase 4): `.yt-studio-hub-main` used `isolation: isolate`,
 * so in-tree overlays could not paint over the sibling Channel Pulse rail.
 * Hub main no longer isolates. Rail (24) and toolbar (25) share the Hub
 * stacking context. Leaf Hub wedges still portal to body.
 *
 * Problem 2 (fixed in Phase 2): Full Creator used to live in YouTubeActionModal
 * at `studioModal` (13000), so nested MUI Dialog/Select sat behind the shell.
 * Full Creator is `creatorSurface` (below MUI modal 1300). Hub chrome that
 * still portals higher (Knowledge Centre 12000) is hidden while the surface
 * is open (`YT_CREATOR_SURFACE_BODY_CLASS`).
 *
 * Phase 3: Full Creator nested Dialog/Select/Tooltip/Confirm use MUI defaults.
 *
 * Allowed elevated tiers (global overlays only):
 * - YouTubeActionModal body portal at `YT_Z_MODAL` for Hub wedges only
 *   (beats Knowledge Centre 12000 — not the rail).
 * - Knowledge Centre body portal at `YT_Z_KNOWLEDGE_CENTER`.
 * - Full Creator surface at `YT_Z_CREATOR_SURFACE` (must stay below MUI modal).
 *
 * Forbidden:
 * - Isolating `.yt-studio-hub-main` again (recreates Problem 1).
 * - CSS `z-index: 13000` on `.yt-modal-backdrop` (inline `YT_Z_MODAL` is source of truth).
 * - New numeric overlay z-index literals (Phase 5 guardrail).
 * - New `YT_Z_MODAL + n` patches for Dialog, Select, Menu, Tooltip, Confirm.
 * - Wiring `YT_Z_MODAL_POPOVER` to any control (retired; number frozen only).
 * - Raising `YT_Z_CREATOR_SURFACE` above MUI modal.
 * - Putting Full Creator back inside YouTubeActionModal.
 * - Global MUI theme `zIndex.modal` bumps.
 * - disablePortal into `.yt-modal-card`.
 */

/** Overlay contract version. Phase 5 adds layering tests and z-index guardrails. */
export const YOUTUBE_STUDIO_OVERLAY_CONTRACT_PHASE = 5 as const;

/** MUI default modal tier (Dialog/Modal/Popover). Documented, not applied. */
export const MUI_DEFAULT_MODAL_Z_INDEX = 1300;

/** MUI default tooltip tier. Documented, not applied. */
export const MUI_DEFAULT_TOOLTIP_Z_INDEX = 1500;

/**
 * Body class while Full Creator surface is open. Hides Hub portals that would
 * otherwise paint above the surface (Knowledge Centre at 12000).
 */
export const YT_CREATOR_SURFACE_BODY_CLASS = "yt-creator-surface-active";

/**
 * Approved Studio tiers. Do not raise `studioModal` or `creatorSurface` to win
 * overlay races — that recreates Problem 2.
 */
export const YOUTUBE_STUDIO_OVERLAY_TIERS = {
  /** In-tree Hub chrome only (toolbar, rail controls). Not body portals. */
  hubChrome: 1,
  hubToolbar: 25,
  rail: 24,
  mobileFab: 1200,
  /**
   * Full Creator viewport surface. Must stay below MUI_DEFAULT_MODAL_Z_INDEX
   * so nested Dialog/Select/Tooltip/Confirm remain MUI-native.
   */
  creatorSurface: 1250,
  knowledgeCenter: 12000,
  /**
   * Hub leaf body portal. Stays at 13000 to beat Knowledge Centre, not the rail.
   */
  studioModal: 13000,
  /**
   * Retired +1 (Phase 3). Frozen so the number is not reused as a live patch.
   * No runtime consumers.
   */
  studioModalNestedPopper: 13001,
} as const;

export type YouTubeStudioOverlayTierName = keyof typeof YOUTUBE_STUDIO_OVERLAY_TIERS;

export const YOUTUBE_STUDIO_OVERLAY_TIER_OWNERS: Record<
  YouTubeStudioOverlayTierName,
  string
> = {
  hubChrome: "YouTubeStudioHub in-tree layout (not an overlay)",
  hubToolbar: "YouTubeStudioHub toolbar (in-tree; z-index 25 vs rail 24)",
  rail: "Channel Pulse / rail CSS (in-tree Hub sibling; not isolated from hub-main)",
  mobileFab: "Mobile Hub FAB (in-tree / CSS; below MUI modal)",
  creatorSurface: "YouTubeVideoCreatorModal dedicated surface (not YouTubeActionModal)",
  knowledgeCenter: "YouTubeKnowledgeCenter body portal",
  studioModal:
    "YouTubeActionModal body portal (Hub wedges only; beats Knowledge Centre)",
  studioModalNestedPopper:
    "Retired Phase 3 — no consumers. Do not wire to Select/Tooltip/Dialog.",
};

export const YOUTUBE_STUDIO_OVERLAY_FORBIDDEN = [
  "New z-index literals in YouTube Creator feature files",
  "New YT_Z_MODAL + n workarounds for nested Dialog/Select/Tooltip/Confirm",
  "Raising YT_Z_MODAL to win overlay races",
  "App-wide MUI zIndex.modal / snackbar / tooltip overrides",
  "disablePortal nested dialogs into .yt-modal-card",
  "Additional multi-step pipelines inside YouTubeActionModal",
] as const;

export const YT_Z_RAIL = YOUTUBE_STUDIO_OVERLAY_TIERS.rail;
export const YT_Z_MOBILE_FAB = YOUTUBE_STUDIO_OVERLAY_TIERS.mobileFab;
export const YT_Z_CREATOR_SURFACE = YOUTUBE_STUDIO_OVERLAY_TIERS.creatorSurface;
export const YT_Z_KNOWLEDGE_CENTER = YOUTUBE_STUDIO_OVERLAY_TIERS.knowledgeCenter;
export const YT_Z_MODAL = YOUTUBE_STUDIO_OVERLAY_TIERS.studioModal;
/** Retired Phase 3. Frozen number only — do not attach to menus or tooltips. */
export const YT_Z_MODAL_POPOVER = YOUTUBE_STUDIO_OVERLAY_TIERS.studioModalNestedPopper;
