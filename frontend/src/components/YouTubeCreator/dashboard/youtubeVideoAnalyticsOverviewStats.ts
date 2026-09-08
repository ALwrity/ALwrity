/**
 * Overview tab copy — real numbers only. No Studio "usual" baseline.
 */

export type OverviewHeadlineWindow =
  | { kind: "rolling"; days: number }
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number }
  | { kind: "lifetime" }
  | { kind: "custom" };

export function formatOverviewHeadline(
  views: number | null | undefined,
  window: number | OverviewHeadlineWindow,
): string {
  if (typeof views !== "number" || Number.isNaN(views)) {
    return "Views for this period are unavailable.";
  }
  const count = new Intl.NumberFormat("en-US").format(views);
  const spec: OverviewHeadlineWindow =
    typeof window === "number" ? { kind: "rolling", days: window } : window;
  if (spec.kind === "rolling") {
    return `Your channel got ${count} views in the last ${spec.days} days.`;
  }
  if (spec.kind === "year") {
    return `Your channel got ${count} views in ${spec.year}.`;
  }
  if (spec.kind === "month") {
    const label = new Date(spec.year, spec.month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return `Your channel got ${count} views in ${label}.`;
  }
  if (spec.kind === "lifetime") {
    return `Your channel got ${count} views since you started.`;
  }
  return `Your channel got ${count} views in this period.`;
}

export function formatWatchHours(hours: number | null | undefined): string {
  if (typeof hours !== "number" || Number.isNaN(hours)) {
    return "—";
  }
  return String(hours);
}

export function formatSubscriberNet(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export function previousPeriodChangeLabel(
  current: number | null | undefined,
  previous: number | null | undefined,
  period: number | { mode: "days" | "period" | "none"; days?: number },
): string {
  const spec =
    typeof period === "number" ? { mode: "days" as const, days: period } : period;
  if (spec.mode === "none") {
    return "—";
  }
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    Number.isNaN(current) ||
    Number.isNaN(previous)
  ) {
    return "—";
  }
  const suffix =
    spec.mode === "days" && spec.days
      ? `previous ${spec.days} days`
      : "previous period";
  if (previous === 0) {
    if (current === 0) {
      return `vs ${suffix}`;
    }
    const signed = current > 0 ? `+${current}` : String(current);
    return `${signed} vs ${suffix}`;
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return `Same as ${suffix}`;
  }
  const direction = percent > 0 ? "more" : "less";
  return `${Math.abs(percent)}% ${direction} than ${suffix}`;
}

export function formatAverageViewDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) {
    return "—";
  }
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatViewPercentage(value: number | null | undefined): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return `${value.toFixed(1)}%`;
}
