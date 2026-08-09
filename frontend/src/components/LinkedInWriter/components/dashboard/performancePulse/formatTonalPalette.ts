/**
 * Shared soft-tonal palette for Performance Pulse and Repurpose Lab action buttons.
 */
import type { CSSProperties } from "react";
import type { PerformanceContentType } from "./types";

export interface FormatTonalColors {
  bg: string;
  border: string;
  text: string;
}

export const FORMAT_TONAL_PALETTE: Record<
  PerformanceContentType,
  FormatTonalColors
> = {
  post: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
  article: { bg: "#ecfdf5", border: "#6ee7b7", text: "#047857" },
  video_script: { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" },
  carousel: { bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9" },
};

export const FORMAT_ACTION_LOCKED_HINT =
  "Coming soon — this format will be available in a future update.";

const LOCKED_STYLE: CSSProperties = {
  background: "#f3f4f6",
  color: "#9ca3af",
  border: "1.5px solid #d1d5db",
  cursor: "not-allowed",
  opacity: 0.88,
};

export interface FormatActionButtonStyleOptions {
  colors: FormatTonalColors;
  locked?: boolean;
  /** Slightly smaller padding for Pulse transform row. */
  compact?: boolean;
}

export function getFormatActionButtonStyle({
  colors,
  locked = false,
  compact = false,
}: FormatActionButtonStyleOptions): CSSProperties {
  const base: CSSProperties = {
    padding: compact ? "5px 10px" : "6px 12px",
    borderRadius: 8,
    fontSize: compact ? 10 : 11,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: compact ? 4 : 5,
    transition:
      "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  if (locked) {
    return { ...base, ...LOCKED_STYLE };
  }

  return {
    ...base,
    background: colors.bg,
    color: colors.text,
    border: `1.5px solid ${colors.border}`,
  };
}

export function getFormatTonalColors(
  type: PerformanceContentType,
): FormatTonalColors {
  return FORMAT_TONAL_PALETTE[type];
}
