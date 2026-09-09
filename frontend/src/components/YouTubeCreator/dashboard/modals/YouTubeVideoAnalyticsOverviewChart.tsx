import React, { useEffect, useMemo, useState } from "react";
import {
  chartAriaLabel,
  chartPlotCoordinates,
  chartTooltipAnchorPercent,
  emptyChartCopy,
  formatChartXLabel,
  formatChartYTick,
  maxChartXLabels,
  metricPolylinePoints,
  nearestChartIndex,
  niceYScale,
  plottedMetricPoints,
  subsampleChartIndices,
  type OverviewChartMetric,
  type YouTubeOverviewDayPoint,
} from "../youtubeVideoAnalyticsChartScale";

const PLOT_WIDTH = 320;
const PLOT_HEIGHT = 96;
const PAD_LEFT = 8;
const PAD_RIGHT = 44;
const PAD_TOP = 8;
const PAD_BOTTOM = 36;
const VIEW_WIDTH = PAD_LEFT + PLOT_WIDTH + PAD_RIGHT;
const VIEW_HEIGHT = PAD_TOP + PLOT_HEIGHT + PAD_BOTTOM;

export const YouTubeVideoAnalyticsOverviewChart: React.FC<{
  series: YouTubeOverviewDayPoint[];
  metric: OverviewChartMetric;
}> = ({ series, metric }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = useMemo(() => plottedMetricPoints(series, metric), [series, metric]);
  const values = useMemo(() => points.map((point) => point.value), [points]);
  const scale = useMemo(() => niceYScale(values), [values]);
  const polyline = metricPolylinePoints(series, metric, PLOT_WIDTH, PLOT_HEIGHT, 0);
  const xLabels = subsampleChartIndices(points.length, maxChartXLabels(PLOT_WIDTH));
  const safeHover =
    hoverIndex != null && hoverIndex < points.length ? points[hoverIndex] : null;

  useEffect(() => {
    setHoverIndex(null);
  }, [metric, series]);

  useEffect(() => {
    if (points.length === 0) {
      console.info("[YouTubeVideoAnalytics] Chart empty", {
        metric,
        seriesCount: series.length,
      });
      return;
    }
    console.info("[YouTubeVideoAnalytics] Chart ready", {
      metric,
      pointCount: points.length,
    });
  }, [metric, points.length, series.length]);

  if (!polyline) {
    return (
      <div
        id="yt-video-analytics-overview-chart"
        className="yt-video-analytics-overview__chart-pane"
      >
        <p className="yt-video-analytics-overview__empty">
          {emptyChartCopy(metric)}
        </p>
      </div>
    );
  }

  const span = scale.max - scale.min || 1;
  const hoverPlot =
    safeHover && hoverIndex != null
      ? chartPlotCoordinates(
          hoverIndex,
          points.length,
          safeHover.value,
          scale.min,
          scale.max,
          PLOT_WIDTH,
          PLOT_HEIGHT,
        )
      : null;
  const tooltipAnchor = hoverPlot
    ? chartTooltipAnchorPercent({
        plotX: hoverPlot.x,
        plotY: hoverPlot.y,
        viewWidth: VIEW_WIDTH,
        viewHeight: VIEW_HEIGHT,
        padLeft: PAD_LEFT,
        padTop: PAD_TOP,
      })
    : null;

  return (
    <div
      id="yt-video-analytics-overview-chart"
      className="yt-video-analytics-overview__chart-pane"
    >
      <div className="yt-video-analytics-overview__chart-wrap">
      <svg
        className="yt-video-analytics-overview__chart"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={chartAriaLabel(metric)}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          try {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (bounds.width <= 0) {
              return;
            }
            const x = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH;
            setHoverIndex(
              nearestChartIndex(points.length, PLOT_WIDTH, 0, x - PAD_LEFT),
            );
          } catch (error: unknown) {
            console.error("[YouTubeVideoAnalytics] Chart hover failed", {
              errorName: error instanceof Error ? error.name : "Error",
              metric,
            });
          }
        }}
      >
        {scale.ticks.map((tick) => {
          const y =
            PAD_TOP + PLOT_HEIGHT - ((tick - scale.min) / span) * PLOT_HEIGHT;
          return (
            <g key={`y-${tick}`}>
              <line
                className="yt-video-analytics-overview__grid"
                x1={PAD_LEFT}
                x2={PAD_LEFT + PLOT_WIDTH}
                y1={y}
                y2={y}
              />
              <text
                className="yt-video-analytics-overview__axis"
                x={VIEW_WIDTH - 4}
                y={y + 4}
                textAnchor="end"
              >
                {formatChartYTick(tick, metric)}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${PAD_LEFT}, ${PAD_TOP})`}>
          <polyline points={polyline} />
          {hoverPlot ? (
            <g>
              <line
                className="yt-video-analytics-overview__hover-line"
                x1={hoverPlot.x}
                x2={hoverPlot.x}
                y1={0}
                y2={PLOT_HEIGHT}
              />
              <circle
                className="yt-video-analytics-overview__hover-dot"
                cx={hoverPlot.x}
                cy={hoverPlot.y}
                r={4}
              />
            </g>
          ) : null}
        </g>
        {xLabels.map((index, slot) => {
          const x =
            PAD_LEFT +
            (points.length === 1 ? PLOT_WIDTH / 2 : (index / (points.length - 1)) * PLOT_WIDTH);
          const isLast = slot === xLabels.length - 1;
          const isFirst = slot === 0;
          const anchor = isFirst ? "start" : isLast ? "end" : "middle";
          return (
            <text
              key={`x-${points[index]?.date || index}`}
              className="yt-video-analytics-overview__axis yt-video-analytics-overview__axis--x"
              x={x}
              y={VIEW_HEIGHT - 10}
              textAnchor={anchor}
            >
              {formatChartXLabel(points[index].date, {
                includeYear: isLast || xLabels.length <= 2,
              })}
            </text>
          );
        })}
      </svg>
      {safeHover && tooltipAnchor ? (
        <p
          className="yt-video-analytics-overview__tooltip"
          role="status"
          style={{ left: `${tooltipAnchor.left}%`, top: `${tooltipAnchor.top}%` }}
        >
          <span>{formatChartXLabel(safeHover.date)}</span>
          <span>{formatChartYTick(safeHover.value, metric)}</span>
        </p>
      ) : null}
      </div>
    </div>
  );
};
