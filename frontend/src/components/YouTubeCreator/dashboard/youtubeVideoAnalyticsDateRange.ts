/**
 * Video Analytics date menu — Studio options, Hub calendar math. No metrics.
 */

export const YOUTUBE_ANALYTICS_MAX_CUSTOM_DAYS = 365;

export type YouTubeAnalyticsDateSelection =
  | { type: "rolling"; id: "last_7" | "last_28" | "last_90" | "last_365"; days: 7 | 28 | 90 | 365 }
  | { type: "lifetime"; id: "lifetime" }
  | { type: "year"; id: string; year: number }
  | { type: "month"; id: string; year: number; month: number }
  | { type: "custom"; id: "custom"; start: string; end: string };

export type YouTubeOverviewRequest = {
  window?: string;
  days?: number;
  start_date?: string;
  end_date?: string;
};

function isValidCalendarDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function calendarDay(source: Date): Date {
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

export function isoDay(value: Date): string {
  const day = calendarDay(value);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

export function parseIsoDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function analyticsYearOptions(today: Date): number[] {
  if (!isValidCalendarDate(today)) {
    return [];
  }
  const current = today.getFullYear();
  return [current, current - 1];
}

export function analyticsMonthOptions(today: Date): Array<{ year: number; month: number }> {
  if (!isValidCalendarDate(today)) {
    return [];
  }
  const current = calendarDay(today);
  const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  return [
    { year: current.getFullYear(), month: current.getMonth() + 1 },
    { year: previous.getFullYear(), month: previous.getMonth() + 1 },
  ];
}

export function calendarYearRange(
  year: number,
  today: Date,
): { start: string; end: string } | null {
  if (!isValidCalendarDate(today)) {
    return null;
  }
  const start = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const end = calendarDay(today) < yearEnd ? calendarDay(today) : yearEnd;
  if (start > end) {
    return null;
  }
  return { start: isoDay(start), end: isoDay(end) };
}

export function calendarMonthRange(
  year: number,
  month: number,
  today: Date,
): { start: string; end: string } | null {
  if (!isValidCalendarDate(today) || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const todayDay = calendarDay(today);
  const end = todayDay < monthEnd ? todayDay : monthEnd;
  if (start > end) {
    return null;
  }
  return { start: isoDay(start), end: isoDay(end) };
}

export function defaultCustomRange(today: Date): { start: string; end: string } {
  const end = calendarDay(today);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 28);
  return { start: isoDay(start), end: isoDay(end) };
}

export function openNativeDatePicker(input: HTMLInputElement | null): void {
  if (!input || typeof input.showPicker !== "function") {
    return;
  }
  try {
    input.showPicker();
  } catch (error) {
    console.warn("[YouTubeVideoAnalytics] Native date picker could not open", {
      errorName: error instanceof Error ? error.name : "Error",
    });
  }
}

export function validateCustomRange(
  startIso: string,
  endIso: string,
  today: Date,
): { ok: true; start: string; end: string } | { ok: false; message: string } {
  const start = parseIsoDay(startIso);
  const end = parseIsoDay(endIso);
  if (!start || !end || !isValidCalendarDate(today)) {
    return { ok: false, message: "Enter a valid start and end date." };
  }
  const todayDay = calendarDay(today);
  if (end > todayDay) {
    return { ok: false, message: "The end date cannot be in the future." };
  }
  if (start > end) {
    return { ok: false, message: "The start date must be on or before the end date." };
  }
  const span = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (span > YOUTUBE_ANALYTICS_MAX_CUSTOM_DAYS) {
    return { ok: false, message: "Custom range cannot exceed 365 days." };
  }
  return { ok: true, start: isoDay(start), end: isoDay(end) };
}

export function toOverviewRequest(
  selection: YouTubeAnalyticsDateSelection,
  today: Date,
): YouTubeOverviewRequest | null {
  if (selection.type === "rolling") {
    return { window: selection.id, days: selection.days };
  }
  if (selection.type === "lifetime") {
    return { window: "lifetime" };
  }
  if (selection.type === "year") {
    const range = calendarYearRange(selection.year, today);
    if (!range) {
      return null;
    }
    return { window: "calendar", start_date: range.start, end_date: range.end };
  }
  if (selection.type === "month") {
    const range = calendarMonthRange(selection.year, selection.month, today);
    if (!range) {
      return null;
    }
    return { window: "calendar", start_date: range.start, end_date: range.end };
  }
  const custom = validateCustomRange(selection.start, selection.end, today);
  if (!custom.ok) {
    return null;
  }
  return { window: "calendar", start_date: custom.start, end_date: custom.end };
}

export function monthLabel(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
}

export function selectionLabel(selection: YouTubeAnalyticsDateSelection): string {
  if (selection.type === "rolling") {
    return `Last ${selection.days} days`;
  }
  if (selection.type === "lifetime") {
    return "Lifetime";
  }
  if (selection.type === "year") {
    return String(selection.year);
  }
  if (selection.type === "month") {
    return monthLabel(selection.month);
  }
  return "Custom";
}

export function formatSelectionRange(
  selection: YouTubeAnalyticsDateSelection,
  today: Date,
): string {
  if (!isValidCalendarDate(today)) {
    return "—";
  }
  if (selection.type === "lifetime") {
    return "Lifetime";
  }
  if (selection.type === "rolling") {
    const end = calendarDay(today);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - selection.days);
    return formatPrettyRange(start, end);
  }
  if (selection.type === "year") {
    const range = calendarYearRange(selection.year, today);
    if (!range) {
      return "—";
    }
    const start = parseIsoDay(range.start);
    const end = parseIsoDay(range.end);
    return start && end ? formatPrettyRange(start, end) : "—";
  }
  if (selection.type === "month") {
    const range = calendarMonthRange(selection.year, selection.month, today);
    if (!range) {
      return "—";
    }
    const start = parseIsoDay(range.start);
    const end = parseIsoDay(range.end);
    return start && end ? formatPrettyRange(start, end) : "—";
  }
  const start = parseIsoDay(selection.start);
  const end = parseIsoDay(selection.end);
  return start && end ? formatPrettyRange(start, end) : "—";
}

function formatPrettyRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const fmt = (value: Date) =>
    value.toLocaleDateString(
      "en-US",
      sameYear
        ? { month: "short", day: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" },
    );
  if (sameYear) {
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

export const YOUTUBE_ANALYTICS_DEFAULT_SELECTION: YouTubeAnalyticsDateSelection = {
  type: "rolling",
  id: "last_28",
  days: 28,
};
