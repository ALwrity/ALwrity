import {
  formatAverageViewDuration,
  formatOverviewHeadline,
  formatSubscriberNet,
  formatViewPercentage,
  formatWatchHours,
  previousPeriodChangeLabel,
} from "../youtubeVideoAnalyticsOverviewStats";
import { viewsPolylinePoints } from "../youtubeVideoAnalyticsChart";

describe("youtubeVideoAnalyticsOverviewStats", () => {
  it("builds a headline from real views", () => {
    expect(formatOverviewHeadline(127, 28)).toBe(
      "Your channel got 127 views in the last 28 days.",
    );
    expect(formatOverviewHeadline(null, 28)).toBe(
      "Views for this period are unavailable.",
    );
    expect(formatOverviewHeadline(71, { kind: "lifetime" })).toBe(
      "Your channel got 71 views since you started.",
    );
    expect(formatOverviewHeadline(71, { kind: "year", year: 2026 })).toBe(
      "Your channel got 71 views in 2026.",
    );
  });

  it("formats watch hours and signed subscriber net", () => {
    expect(formatWatchHours(0.7)).toBe("0.7");
    expect(formatWatchHours(null)).toBe("—");
    expect(formatSubscriberNet(2)).toBe("+2");
    expect(formatSubscriberNet(0)).toBe("0");
    expect(formatSubscriberNet(-1)).toBe("-1");
  });

  it("labels previous-period change without inventing a percent when previous is 0", () => {
    expect(previousPeriodChangeLabel(127, 62, 28)).toBe(
      "105% more than previous 28 days",
    );
    expect(previousPeriodChangeLabel(10, 0, 7)).toBe("+10 vs previous 7 days");
    expect(previousPeriodChangeLabel(null, 10, 28)).toBe("—");
    expect(previousPeriodChangeLabel(71, 10, { mode: "none" })).toBe("—");
    expect(previousPeriodChangeLabel(71, 10, { mode: "period" })).toBe(
      "610% more than previous period",
    );
  });

  it("formats duration and optional percentage", () => {
    expect(formatAverageViewDuration(18)).toBe("0:18");
    expect(formatViewPercentage(64.3)).toBe("64.3%");
    expect(formatViewPercentage(null)).toBeNull();
  });
});

describe("youtubeVideoAnalyticsChart", () => {
  it("builds polyline points from views_by_day", () => {
    const points = viewsPolylinePoints(
      [
        { date: "2026-08-10", views: 0 },
        { date: "2026-09-04", views: 27 },
      ],
      100,
      40,
      0,
    );
    expect(points).toBe("0.0,40.0 100.0,0.0");
  });

  it("returns an empty path when there is no numeric series", () => {
    expect(viewsPolylinePoints([{ date: "2026-09-04", views: null }], 100, 40)).toBe(
      "",
    );
  });
});
