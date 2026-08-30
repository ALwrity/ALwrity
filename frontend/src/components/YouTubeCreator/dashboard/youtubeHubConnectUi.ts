import type { CSSProperties } from "react";

/** Primary hub-axis connect CTA — aligned with LinkedIn Studio connect button sizing. */
export const YOUTUBE_CONNECT_CTA = "Connect YouTube\u26a1";

/** Hub-axis CTA when the channel is already connected (LinkedIn disconnect parity). */
export const YOUTUBE_DISCONNECT_CTA = "Disconnect YouTube";

/** Hub-axis CTA while revoke is in flight. */
export const YOUTUBE_DISCONNECTING_CTA = "Disconnecting...";

/** Create-wedge / Start New Video label — not the hub-axis connect button. */
export const YOUTUBE_CREATE_VIDEO_CTA = "Create Video";

/** Shared dimensions with LinkedIn `CONNECT_BUTTON_STYLE` (YouTube brand colors). */
export const YOUTUBE_HUB_CONNECT_BUTTON_STYLE: CSSProperties = {
  background: "linear-gradient(135deg, #CC0000 0%, #991B1B 100%)",
  border: "none",
  borderRadius: 12,
  padding: "12px 40px",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minWidth: 220,
  boxShadow: "0 4px 15px rgba(204, 0, 0, 0.35)",
  transition: "all 0.2s ease",
};

/** Max width for the hub-axis connect anchor wrapper (LinkedIn parity). */
export const YOUTUBE_HUB_CONNECT_ANCHOR_MAX_WIDTH_PX = 360;
