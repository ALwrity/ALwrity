/**
 * Grow Network wedge — tokens aligned with LinkedIn dashboard vibrant UI.
 * Used for documentation; CSS custom properties mirror these in grow-network-wedge.css.
 */
export const GROW_NETWORK_THEME = {
  linkedInPrimary: "#0a66c2",
  linkedInDeep: "#004182",
  linkedInMid: "#0077b5",
  titleColor: "#0a66c2",
  /** Dashboard hero / CTA gradient (single LinkedIn-blue family). */
  primaryHeaderGradient:
    "linear-gradient(135deg, #0077b5 0%, #0a66c2 55%, #004182 100%)",
  draftActionGradient:
    "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  connectActionGradient:
    "linear-gradient(135deg, #0a66c2 0%, #004182 100%)",
  pendingSurfaceGradient:
    "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
  lockedAccent: "#dc2626",
  liveAccent: "#0a66c2",
  sidebarLabel: "Network Advisor",
  primaryLabel: "Live on LinkedIn",
} as const;
