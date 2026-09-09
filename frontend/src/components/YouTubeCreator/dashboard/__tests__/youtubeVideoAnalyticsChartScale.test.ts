import {
  chartPlotCoordinates,
  chartPolylinePoints,
  chartTooltipAnchorPercent,
  formatChartXLabel,
  formatChartYTick,
  maxChartXLabels,
  metricPolylinePoints,
  nearestChartIndex,
  niceYScale,
  plottedMetricPoints,
  subsampleChartIndices,
  type YouTubeOverviewDayPoint,
} from "../youtubeVideoAnalyticsChartScale";

describe("youtubeVideoAnalyticsChartScale", () => {
  it("builds nice Y ticks from views including zero", () => {
    const scale = niceYScale([0, 27]);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(27);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(3);
    expect(scale.ticks.length).toBeLessThanOrEqual(6);
    expect(formatChartYTick(scale.ticks[0], "views")).toBe("0");
  });

  it("builds fractional Y ticks for small watch-hour ranges", () => {
    const scale = niceYScale([0, 0.3]);
    expect(scale.ticks[0]).toBe(0);
    expect(scale.max).toBeGreaterThanOrEqual(0.3);
    expect(formatChartYTick(0.1, "watch_hours")).toBe("0.1");
    expect(formatChartYTick(0, "watch_hours")).toBe("0.0");
  });

  it("includes negative ticks and signed subscriber labels", () => {
    const scale = niceYScale([-2, 3]);
    expect(scale.min).toBeLessThanOrEqual(-2);
    expect(scale.max).toBeGreaterThanOrEqual(3);
    expect(scale.ticks.some((tick) => tick < 0)).toBe(true);
    expect(formatChartYTick(2, "subscribers_net")).toBe("+2");
    expect(formatChartYTick(-1, "subscribers_net")).toBe("-1");
    expect(formatChartYTick(0, "subscribers_net")).toBe("0");
  });

  it("subsamples X dates and keeps first and last", () => {
    const dates = Array.from({ length: 28 }, (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`);
    const labels = subsampleChartIndices(dates.length, 6).map((index) => ({
      index,
      label: formatChartXLabel(dates[index]),
    }));
    expect(labels[0]?.index).toBe(0);
    expect(labels[labels.length - 1]?.index).toBe(27);
    expect(labels.length).toBeLessThanOrEqual(6);
    expect(labels[0]?.label).toMatch(/Aug 1, 2026/);
  });

  it("caps X labels so date strings fit the plot width", () => {
    expect(maxChartXLabels(320)).toBeLessThanOrEqual(4);
    const count = maxChartXLabels(320);
    const indices = subsampleChartIndices(90, count);
    expect(indices.length).toBeLessThanOrEqual(count);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(89);
    for (let i = 1; i < indices.length; i += 1) {
      const gap = ((indices[i] - indices[i - 1]) / 89) * 320;
      expect(gap).toBeGreaterThanOrEqual(80);
    }
    expect(formatChartXLabel("2026-06-14", { includeYear: false })).toBe("Jun 14");
    expect(formatChartXLabel("2026-09-05", { includeYear: true })).toMatch(/Sep 5, 2026/);
  });

  it("uses the nice Y scale so the polyline matches the axis", () => {
    const series: YouTubeOverviewDayPoint[] = [
      { date: "2026-08-10", views: 0, watch_hours: 0, subscribers_net: 0 },
      { date: "2026-09-04", views: 27, watch_hours: 0.3, subscribers_net: 2 },
    ];
    const values = plottedMetricPoints(series, "views").map((point) => point.value);
    const scale = niceYScale(values);
    const points = chartPolylinePoints(values, 100, 40, 0, scale.min, scale.max);
    const yHigh = 40 - ((27 - scale.min) / (scale.max - scale.min)) * 40;
    expect(points).toBe(`0.0,40.0 100.0,${yHigh.toFixed(1)}`);
    expect(metricPolylinePoints(series, "views", 100, 40, 0)).toBe(points);
  });

  it("returns an empty path when there is no numeric series", () => {
    expect(
      metricPolylinePoints([{ date: "2026-09-04", views: null }], "views", 100, 40),
    ).toBe("");
  });

  it("picks the nearest point for hover from the plot X", () => {
    expect(nearestChartIndex(2, 100, 0, 0)).toBe(0);
    expect(nearestChartIndex(2, 100, 0, 100)).toBe(1);
    expect(nearestChartIndex(5, 100, 0, 50)).toBe(2);
  });

  it("maps a hovered point into plot coordinates and clamps tooltip percents", () => {
    const low = chartPlotCoordinates(0, 2, 0, 0, 30, 100, 40);
    const high = chartPlotCoordinates(1, 2, 27, 0, 30, 100, 40);
    expect(low.x).toBe(0);
    expect(low.y).toBe(40);
    expect(high.x).toBe(100);
    expect(high.y).toBeLessThan(low.y);
    const nearEdge = chartTooltipAnchorPercent({
      plotX: 100,
      plotY: 2,
      viewWidth: 372,
      viewHeight: 140,
      padLeft: 8,
      padTop: 8,
    });
    expect(nearEdge.left).toBeGreaterThanOrEqual(2);
    expect(nearEdge.left).toBeLessThanOrEqual(72);
    expect(nearEdge.top).toBeGreaterThanOrEqual(2);
    expect(nearEdge.top).toBeLessThanOrEqual(70);
  });

  it("returns safe plot and tooltip anchors when inputs are not finite", () => {
    expect(chartPlotCoordinates(Number.NaN, 2, 10, 0, 30, 100, 40)).toEqual({
      x: 0,
      y: 40,
    });
    expect(chartPlotCoordinates(0, 0, 10, 0, 30, 100, 40)).toEqual({
      x: 0,
      y: 40,
    });
    expect(
      chartTooltipAnchorPercent({
        plotX: Number.NaN,
        plotY: 0,
        viewWidth: 0,
        viewHeight: 0,
        padLeft: 8,
        padTop: 8,
      }),
    ).toEqual({ left: 2, top: 2 });
  });
});
