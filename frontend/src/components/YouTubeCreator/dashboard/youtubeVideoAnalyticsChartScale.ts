/**
 * Overview chart scale — dynamic X dates and Y ticks. No chart library.
 */

export type OverviewChartMetric = "views" | "watch_hours" | "subscribers_net";

export type YouTubeOverviewDayPoint = {
  date: string;
  views: number | null;
  watch_hours?: number | null;
  subscribers_net?: number | null;
};

export function metricValue(
  point: YouTubeOverviewDayPoint,
  metric: OverviewChartMetric,
): number | null {
  const value = point[metric];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

export function numericMetricValues(
  series: YouTubeOverviewDayPoint[],
  metric: OverviewChartMetric,
): number[] {
  return series
    .map((point) => metricValue(point, metric))
    .filter((value): value is number => value != null);
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }
  const exp = Math.floor(Math.log10(raw));
  const mag = 10 ** exp;
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function niceYScale(
  values: number[],
  tickCount = 4,
): { min: number; max: number; ticks: number[] } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return { min: 0, max: 1, ticks: [0, 1] };
  }
  const dataMax = Math.max(...finite);
  const dataMin = Math.min(...finite);
  const min = dataMin >= 0 ? 0 : dataMin;
  const max = dataMax <= min ? min + 1 : dataMax;
  const span = max - min;
  const step = niceStep(span / Math.max(tickCount - 1, 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  const roundedMax = Number((niceMax + step / 2).toPrecision(12));
  for (let tick = niceMin; tick <= roundedMax; tick = Number((tick + step).toPrecision(12))) {
    ticks.push(tick);
  }
  return { min: niceMin, max: ticks[ticks.length - 1] ?? niceMax, ticks };
}

export function formatChartYTick(value: number, metric: OverviewChartMetric): string {
  if (metric === "watch_hours") {
    return value.toFixed(1);
  }
  const rounded = Math.round(value);
  if (metric === "subscribers_net" && rounded > 0) {
    return `+${rounded}`;
  }
  return String(rounded);
}

export function formatChartXLabel(
  isoDay: string,
  options?: { includeYear?: boolean },
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!match) {
    return isoDay;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const includeYear = options?.includeYear !== false;
  return parsed.toLocaleDateString(
    "en-US",
    includeYear
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric" },
  );
}

export const CHART_X_LABEL_MIN_GAP = 92;

export function maxChartXLabels(
  plotWidth: number,
  minGap = CHART_X_LABEL_MIN_GAP,
): number {
  if (!Number.isFinite(plotWidth) || plotWidth <= 0) {
    return 2;
  }
  return Math.max(2, Math.min(4, Math.floor(plotWidth / minGap)));
}

export function subsampleChartIndices(length: number, maxLabels = 6): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= maxLabels) {
    return Array.from({ length }, (_, index) => index);
  }
  const picked = new Set<number>();
  for (let slot = 0; slot < maxLabels; slot += 1) {
    picked.add(Math.round((slot * (length - 1)) / (maxLabels - 1)));
  }
  return Array.from(picked).sort((left, right) => left - right);
}

export function plottedMetricPoints(
  series: YouTubeOverviewDayPoint[],
  metric: OverviewChartMetric,
): Array<{ date: string; value: number }> {
  return series.flatMap((point) => {
    const value = metricValue(point, metric);
    return value == null ? [] : [{ date: point.date, value }];
  });
}

export function metricPolylinePoints(
  series: YouTubeOverviewDayPoint[],
  metric: OverviewChartMetric,
  width: number,
  height: number,
  padding = 0,
): string {
  const plotted = plottedMetricPoints(series, metric);
  if (plotted.length === 0) {
    return "";
  }
  const values = plotted.map((point) => point.value);
  const scale = niceYScale(values);
  return chartPolylinePoints(values, width, height, padding, scale.min, scale.max);
}

export function chartPolylinePoints(
  values: number[],
  width: number,
  height: number,
  padding: number,
  yMin: number,
  yMax: number,
): string {
  if (values.length === 0) {
    return "";
  }
  const span = yMax - yMin || 1;
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);
  return values
    .map((value, index) => {
      const x =
        padding +
        (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
      const y = padding + innerHeight - ((value - yMin) / span) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function nearestChartIndex(
  pointCount: number,
  width: number,
  padding: number,
  x: number,
): number {
  if (pointCount <= 1) {
    return 0;
  }
  const innerWidth = Math.max(width - padding * 2, 1);
  const ratio = (x - padding) / innerWidth;
  const index = Math.round(ratio * (pointCount - 1));
  return Math.min(pointCount - 1, Math.max(0, index));
}

export function emptyChartCopy(metric: OverviewChartMetric): string {
  if (metric === "watch_hours") {
    return "No daily watch time in this period.";
  }
  if (metric === "subscribers_net") {
    return "No daily subscribers in this period.";
  }
  return "No daily views in this period.";
}

export function chartAriaLabel(metric: OverviewChartMetric): string {
  if (metric === "watch_hours") {
    return "Daily watch time";
  }
  if (metric === "subscribers_net") {
    return "Daily subscribers";
  }
  return "Daily views";
}
