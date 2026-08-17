/**
 * Helpers for YouTube Plan Details outline + title editing.
 */

import type { VideoPlan } from "../../../services/youtubeApi";

export interface OutlineItem {
  id: string;
  section: string;
  description: string;
  duration_estimate: number;
}

export function createOutlineItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeDuration(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }
  return Math.round(parsed);
}

export function toOutlineItems(
  outline: VideoPlan["content_outline"] | undefined,
): OutlineItem[] {
  return (outline || []).map((item) => ({
    id: createOutlineItemId(),
    section: (item.section || "").trim(),
    description: item.description || "",
    duration_estimate: normalizeDuration(item.duration_estimate),
  }));
}

export function fromOutlineItems(items: OutlineItem[]): VideoPlan["content_outline"] {
  return items.map((item) => ({
    section: item.section.trim(),
    description: (item.description || "").trim(),
    duration_estimate: normalizeDuration(item.duration_estimate),
  }));
}

export function sumOutlineDurations(
  items: Array<{ duration_estimate?: number }>,
): number {
  return items.reduce((sum, item) => sum + (Number(item.duration_estimate) || 0), 0);
}

export function isDurationOffTarget(sum: number, targetSeconds?: number): boolean {
  if (!targetSeconds || targetSeconds <= 0) {
    return false;
  }
  return Math.abs(sum - targetSeconds) > targetSeconds * 0.2;
}

export function normalizeTitleSuggestions(raw: unknown, max = 5): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const title = typeof item === "string" ? item.trim().slice(0, 70) : "";
    const key = title.toLowerCase();
    if (!title || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(title);
    if (result.length >= max) {
      break;
    }
  }
  return result;
}

export function normalizeKeywordList(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const keyword = typeof item === "string" ? item.trim() : "";
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(keyword);
    if (result.length >= max) {
      break;
    }
  }
  return result;
}

export function validatePlanEdits(params: {
  selectedTitle: string;
  outline: OutlineItem[];
}): string | null {
  if (!params.selectedTitle.trim()) {
    return "Add a video title before saving.";
  }
  if (params.outline.length === 0) {
    return "Add at least one outline section.";
  }
  if (params.outline.some((item) => !item.section.trim())) {
    return "Each outline section needs a name.";
  }
  return null;
}
