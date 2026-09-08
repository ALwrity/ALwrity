/**
 * Daily views polyline for Overview. No chart library.
 */

export type YouTubeOverviewDayPoint = {
  date: string;
  views: number | null;
};

export function viewsPolylinePoints(
  series: YouTubeOverviewDayPoint[],
  width: number,
  height: number,
  padding = 8,
): string {
  const numeric = series.filter(
    (point): point is YouTubeOverviewDayPoint & { views: number } =>
      typeof point.views === "number" && !Number.isNaN(point.views),
  );
  if (numeric.length === 0) {
    return "";
  }
  const max = Math.max(...numeric.map((point) => point.views), 1);
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);
  return numeric
    .map((point, index) => {
      const x =
        padding +
        (numeric.length === 1 ? innerWidth / 2 : (index / (numeric.length - 1)) * innerWidth);
      const y = padding + innerHeight - (point.views / max) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
