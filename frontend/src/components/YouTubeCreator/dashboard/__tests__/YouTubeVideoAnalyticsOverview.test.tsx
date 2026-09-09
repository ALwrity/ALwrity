/**
 * Overview metric chart — Hub SVG with dynamic axes. No chart library.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeVideoAnalyticsOverview } from "../modals/YouTubeVideoAnalyticsOverview";
import { YOUTUBE_ANALYTICS_DEFAULT_SELECTION } from "../youtubeVideoAnalyticsDateRange";
import {
  chartAriaLabel,
  formatChartXLabel,
  formatChartYTick,
  niceYScale,
  numericMetricValues,
} from "../youtubeVideoAnalyticsChartScale";

const SERIES = [
  {
    date: "2026-08-10",
    views: 0,
    watch_hours: 0,
    subscribers_net: 0,
  },
  {
    date: "2026-09-04",
    views: 27,
    watch_hours: 0.3,
    subscribers_net: 2,
  },
];

const PAYLOAD = {
  success: true,
  compare: true,
  current: { views: 127, watch_hours: 0.7, subscribers_net: 2 },
  previous: { views: 62, watch_hours: 0.3, subscribers_net: 1 },
  views_by_day: SERIES,
  top_videos: [],
  latest_videos: [],
};

describe("YouTubeVideoAnalyticsOverview chart", () => {
  it("defaults to Views and draws dynamic X and Y labels from the series", () => {
    render(
      <YouTubeVideoAnalyticsOverview
        selection={YOUTUBE_ANALYTICS_DEFAULT_SELECTION}
        payload={PAYLOAD}
        status={null}
      />,
    );
    expect(screen.getByRole("tab", { name: /Views/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("img", { name: chartAriaLabel("views") })).toBeTruthy();
    expect(screen.getByText(formatChartXLabel("2026-08-10"))).toBeTruthy();
    expect(screen.getByText(formatChartXLabel("2026-09-04"))).toBeTruthy();
    const scale = niceYScale(numericMetricValues(SERIES, "views"));
    expect(screen.getByText(formatChartYTick(scale.ticks[0], "views"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /see more/i })).toBeNull();
    const svg = screen.getByRole("img", { name: chartAriaLabel("views") });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      width: 372,
      height: 132,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 132,
      right: 372,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(svg, { clientX: 186, clientY: 40 });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(document.querySelector(".yt-video-analytics-overview__panel")).toBeTruthy();
  });

  it("does not paint overlapping X-axis dates for a long window", () => {
    const longSeries = Array.from({ length: 90 }, (_, index) => {
      const day = new Date(2026, 5, 14 + index);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      return { date: iso, views: index, watch_hours: 0.1, subscribers_net: 0 };
    });
    render(
      <YouTubeVideoAnalyticsOverview
        selection={YOUTUBE_ANALYTICS_DEFAULT_SELECTION}
        payload={{ ...PAYLOAD, views_by_day: longSeries }}
        status={null}
      />,
    );
    const labels = Array.from(
      document.querySelectorAll(".yt-video-analytics-overview__axis--x"),
    );
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels.length).toBeLessThanOrEqual(4);
  });

  it("switches the line and axes to watch time and subscribers", () => {
    render(
      <YouTubeVideoAnalyticsOverview
        selection={YOUTUBE_ANALYTICS_DEFAULT_SELECTION}
        payload={PAYLOAD}
        status={null}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Watch time/ }));
    expect(screen.getByRole("img", { name: chartAriaLabel("watch_hours") })).toBeTruthy();
    const watchScale = niceYScale(
      numericMetricValues(SERIES, "watch_hours"),
    );
    expect(
      screen.getByText(formatChartYTick(watchScale.max, "watch_hours")),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Subscribers/ }));
    expect(
      screen.getByRole("img", { name: chartAriaLabel("subscribers_net") }),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Subscribers/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows metric-specific empty copy instead of invented points", () => {
    render(
      <YouTubeVideoAnalyticsOverview
        selection={YOUTUBE_ANALYTICS_DEFAULT_SELECTION}
        payload={{ ...PAYLOAD, views_by_day: [] }}
        status={null}
      />,
    );
    expect(screen.getByText("No daily views in this period.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Watch time/ }));
    expect(screen.getByText("No daily watch time in this period.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Subscribers/ }));
    expect(screen.getByText("No daily subscribers in this period.")).toBeTruthy();
  });
});
