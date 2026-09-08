/**
 * Overview tab copy — real numbers only. No Studio "usual" baseline.
 */

export function formatOverviewHeadline(
  views: number | null | undefined,
  days: number,
): string {
  if (typeof views !== "number" || Number.isNaN(views)) {
    return "Views for this period are unavailable.";
  }
  const count = new Intl.NumberFormat("en-US").format(views);
  return `Your channel got ${count} views in the last ${days} days.`;
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
  days: number,
): string {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    Number.isNaN(current) ||
    Number.isNaN(previous)
  ) {
    return "—";
  }
  if (previous === 0) {
    if (current === 0) {
      return `vs previous ${days} days`;
    }
    const signed = current > 0 ? `+${current}` : String(current);
    return `${signed} vs previous ${days} days`;
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return `Same as previous ${days} days`;
  }
  const direction = percent > 0 ? "more" : "less";
  return `${Math.abs(percent)}% ${direction} than previous ${days} days`;
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
