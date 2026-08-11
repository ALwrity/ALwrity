/**
 * Format Transformer target formats — Carousel and Video Script are frontend-locked.
 */
import { FORMAT_ACTION_LOCKED_HINT } from "../performancePulse/formatTonalPalette";

export const FORMAT_TRANSFORMER_LOCKED_HINT = FORMAT_ACTION_LOCKED_HINT;

export interface FormatTransformerOption {
  type: "article" | "carousel" | "video_script";
  icon: string;
  label: string;
  desc: string;
  accent: string;
  locked?: boolean;
}

export const FORMAT_TRANSFORMER_OPTIONS: FormatTransformerOption[] = [
  {
    type: "article",
    icon: "📄",
    label: "Article",
    desc: "Long-form thought leadership piece",
    accent: "#057642",
  },
  {
    type: "carousel",
    icon: "🎠",
    label: "Carousel",
    desc: "Visual slide deck (5-8 slides)",
    accent: "#8b5cf6",
    locked: true,
  },
  {
    type: "video_script",
    icon: "🎬",
    label: "Video Script",
    desc: "Hook, main content, CTA",
    accent: "#dc2626",
    locked: true,
  },
];

export function isFormatTransformerLocked(
  type: FormatTransformerOption["type"],
): boolean {
  return FORMAT_TRANSFORMER_OPTIONS.some((f) => f.type === type && f.locked);
}
