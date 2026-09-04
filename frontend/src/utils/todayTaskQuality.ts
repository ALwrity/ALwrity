/**
 * Pure helpers for rendering per-task quality chips on the EnhancedTodayModal.
 *
 * Phase 4: each task card can carry a small set of quality/reasoning chips
 * drawn from the task's metadata (`confidence`, `selection_score`,
 * `synthesis_mode`, `roi_score`, `impact_label`). The chip descriptors here
 * are rendered inline in the EnhancedTodayModal without pulling in any DOM
 * or network dependency.
 *
 * All imports from the workflow types are `import type` (erased at runtime),
 * so this module stays lightweight and fully unit-testable.
 */
import type { TodayTask } from "../types/workflow";

export interface QualityChip {
  /** Short human-readable label, e.g. "80% confidence". */
  label: string;
  /** Tone drives the MUI Chip `color` prop in the consuming component. */
  tone: "success" | "warning" | "info" | "default";
}

function confidenceTone(value: number): QualityChip["tone"] {
  if (value >= 0.6) return "success";
  if (value >= 0.4) return "warning";
  return "default";
}

/**
 * Render a 0-1 fraction or 0-100 integer as a percentage label.
 * The LinkedIn pipeline stores `roi_score` as 0-100; the gap radar
 * stores it as 0-1. A simple threshold handles both without the
 * caller needing to know the workflow type.
 */
function roiPercent(value: number): string {
  const pct = value > 1 ? Math.round(value) : Math.round(value * 100);
  return `${pct}% ROI`;
}

/**
 * Derive the quality / reasoning chips for a single `TodayTask`.
 * Returns an empty array when no quality data is present.
 */
export function taskQualityChips(task: TodayTask): QualityChip[] {
  const chips: QualityChip[] = [];
  const meta = task.metadata;
  if (!meta) return chips;

  // --- confidence ---
  if (typeof meta.confidence === "number" && Number.isFinite(meta.confidence)) {
    const pct = Math.round(meta.confidence * 100);
    chips.push({ label: `${pct}% confidence`, tone: confidenceTone(meta.confidence) });
  }

  // --- selection score (daily committee, 0-1) ---
  if (typeof meta.selection_score === "number" && Number.isFinite(meta.selection_score)) {
    const pct = Math.round(meta.selection_score * 100);
    chips.push({ label: `${pct}% selection score`, tone: confidenceTone(meta.selection_score) });
  }

  // --- synthesis mode ---
  if (typeof meta.synthesis_mode === "string" && meta.synthesis_mode) {
    switch (meta.synthesis_mode) {
      case "template_fallback":
        chips.push({ label: "Template fallback", tone: "warning" });
        break;
      case "llm":
        chips.push({ label: "AI-generated", tone: "info" });
        break;
      case "data_derived":
        chips.push({ label: "Data-derived", tone: "success" });
        break;
    }
  }

  // --- impact / ROI (prefer the labelled variant when available) ---
  if (typeof meta.impact_label === "string" && meta.impact_label) {
    chips.push({ label: `Impact: ${meta.impact_label}`, tone: "default" });
  } else if (typeof meta.roi_score === "number" && Number.isFinite(meta.roi_score)) {
    const normalized = meta.roi_score > 1 ? meta.roi_score / 100 : meta.roi_score;
    chips.push({ label: roiPercent(meta.roi_score), tone: confidenceTone(normalized) });
  }

  return chips;
}

export default taskQualityChips;