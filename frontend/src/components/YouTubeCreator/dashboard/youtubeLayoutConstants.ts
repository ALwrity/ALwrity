/**
 * YouTube Studio responsive breakpoints — aligned with LinkedIn Studio dashboard.
 */

/** Primary mobile studio boundary (CSS `max-width`). */
export const MOBILE_STUDIO_MAX_WIDTH_PX = 600;

/** Desktop dashboard min width — always MOBILE + 1 for matchMedia parity. */
export const DESKTOP_DASHBOARD_MIN_WIDTH_PX = MOBILE_STUDIO_MAX_WIDTH_PX + 1;

/** CSS custom property on hero stage — shared axis for radial hub + connect CTA. */
export const HUB_CENTER_LEFT_CSS_VAR = "--yt-hub-center-left";

/** Fixed width of the desktop analytics rail (matches youtube-dashboard-layout.css). */
export const DASHBOARD_ANALYTICS_RAIL_WIDTH_PX = 340;
