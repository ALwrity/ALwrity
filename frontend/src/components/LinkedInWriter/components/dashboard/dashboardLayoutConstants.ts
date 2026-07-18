/**
 * LinkedIn Studio responsive breakpoints — single source of truth.
 * Keep aligned with `alwrity-copilot.css` @media blocks, `useDesktopViewport()`, and tour helpers.
 *
 * | Breakpoint | Value | Effect |
 * |------------|------:|--------|
 * | Mobile Studio | ≤960px | Mobile grid, FAB, analytics section; radial hidden |
 * | Desktop Studio | ≥961px | Radial ring, right rail, corner Co-Pilot dock |
 * | Header compact | ≤768px | Two-row header (logo/persona + controls) |
 * | Tour phone | ≤640px | Compact tour tooltips (vs tablet 641–960) |
 */

/** Primary mobile studio boundary (CSS `max-width`). */
export const MOBILE_STUDIO_MAX_WIDTH_PX = 960;

/** Desktop dashboard min width — always `MOBILE_STUDIO_MAX_WIDTH_PX + 1` for matchMedia parity. */
export const DESKTOP_DASHBOARD_MIN_WIDTH_PX = MOBILE_STUDIO_MAX_WIDTH_PX + 1;

/** Header two-row compact layout. */
export const HEADER_COMPACT_MAX_WIDTH_PX = 768;

/** Tour phone variant (distinct from tablet 641–960px). */
export const TOUR_PHONE_MAX_WIDTH_PX = 640;

/**
 * CSS custom property on `.linkedin-dashboard-hero-stage` holding the shared
 * horizontal axis for radial ring, profile hub, and connect button (e.g. `58.2%`).
 * Set by `LinkedInDashboardHero` from `layoutHubCenterPercent()`.
 */
export const HUB_CENTER_LEFT_CSS_VAR = '--hub-center-left';

/** Centered modal panel for mobile header studio tab actions (Growth, Persona, Resume, Optimise). */
export const STUDIO_TAB_ACTION_MODAL_CLASS = 'linkedin-studio-tab-action-modal';
