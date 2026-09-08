/**
 * Video Analytics chrome helpers — tabs, date presets, range labels.
 * Does not invent view/CTR numbers.
 */
import {
  YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET,
  YOUTUBE_VIDEO_ANALYTICS_PRESETS,
  YOUTUBE_VIDEO_ANALYTICS_TABS,
  dateRangeForPreset,
  emptyAnalyticsPanelCopy,
  formatAnalyticsDateRange,
  formatAnalyticsPresetLabel,
  nextAnalyticsTab,
  overviewDaysForPreset,
} from "../youtubeVideoAnalyticsUi";

const TODAY = new Date(2026, 8, 8);

describe("youtubeVideoAnalyticsUi", () => {
  it("exposes Studio tab order Overview, Reach, Engagement, Audience", () => {
    expect(YOUTUBE_VIDEO_ANALYTICS_TABS.map((tab) => tab.id)).toEqual([
      "overview",
      "reach",
      "engagement",
      "audience",
    ]);
    expect(YOUTUBE_VIDEO_ANALYTICS_TABS.map((tab) => tab.label)).toEqual([
      "Overview",
      "Reach",
      "Engagement",
      "Audience",
    ]);
  });

  it("defaults the date filter to Last 28 days like Channel Pulse", () => {
    expect(YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET).toBe("last_28");
    expect(formatAnalyticsPresetLabel("last_28")).toBe("Last 28 days");
    expect(YOUTUBE_VIDEO_ANALYTICS_PRESETS.map((row) => row.id)).toEqual([
      "last_7",
      "last_28",
      "last_90",
      "all_time",
    ]);
  });

  it("computes inclusive calendar ranges from the selected preset", () => {
    const week = dateRangeForPreset("last_7", TODAY);
    expect(week.start?.getFullYear()).toBe(2026);
    expect(week.start?.getMonth()).toBe(8);
    expect(week.start?.getDate()).toBe(1);
    expect(week.end?.getDate()).toBe(8);
    expect(formatAnalyticsDateRange("last_7", TODAY)).toBe("Sep 1 – Sep 8, 2026");

    expect(formatAnalyticsDateRange("last_28", TODAY)).toBe("Aug 11 – Sep 8, 2026");
    expect(formatAnalyticsDateRange("last_90", TODAY)).toBe("Jun 10 – Sep 8, 2026");
  });

  it("labels all-time without inventing a YouTube-era start date", () => {
    const lifetime = dateRangeForPreset("all_time", TODAY);
    expect(lifetime.start).toBeNull();
    expect(lifetime.end).toBeNull();
    expect(formatAnalyticsDateRange("all_time", TODAY)).toBe("All time");
    expect(formatAnalyticsPresetLabel("all_time")).toBe("All time");
  });

  it("uses waiting copy per tab instead of fake metrics", () => {
    expect(emptyAnalyticsPanelCopy("overview")).toBe(
      "Overview metrics will show here when analytics is connected.",
    );
    expect(emptyAnalyticsPanelCopy("reach")).toBe(
      "Reach metrics will show here when analytics is connected.",
    );
    expect(emptyAnalyticsPanelCopy("engagement")).toBe(
      "Engagement metrics will show here when analytics is connected.",
    );
    expect(emptyAnalyticsPanelCopy("audience")).toBe(
      "Audience metrics will show here when analytics is connected.",
    );
    expect(emptyAnalyticsPanelCopy("overview")).not.toMatch(/\d/);
  });

  it("maps date presets to overview window days and skips All time", () => {
    expect(overviewDaysForPreset("last_7")).toBe(7);
    expect(overviewDaysForPreset("last_28")).toBe(28);
    expect(overviewDaysForPreset("last_90")).toBe(90);
    expect(overviewDaysForPreset("all_time")).toBeNull();
  });

  it("does not treat an invalid calendar date as All time", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalid = new Date("not-a-date");
    expect(dateRangeForPreset("last_28", invalid)).toEqual({
      start: null,
      end: null,
    });
    expect(formatAnalyticsDateRange("last_28", invalid)).toBe("—");
    expect(formatAnalyticsDateRange("all_time", invalid)).toBe("All time");
    expect(warn.mock.calls.join(" ")).toMatch(/Invalid date for range/);
    warn.mockRestore();
  });

  it("moves between Studio tabs in order", () => {
    expect(nextAnalyticsTab("overview", 1)).toBe("reach");
    expect(nextAnalyticsTab("audience", 1)).toBe("overview");
    expect(nextAnalyticsTab("overview", -1)).toBe("audience");
  });
});
