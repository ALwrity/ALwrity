/**
 * Video Analytics chrome helpers — tabs, date presets, waiting copy.
 * Does not invent view/CTR numbers.
 */
import {
  YOUTUBE_VIDEO_ANALYTICS_PRESETS,
  YOUTUBE_VIDEO_ANALYTICS_TABS,
  emptyAnalyticsPanelCopy,
  nextAnalyticsTab,
} from "../youtubeVideoAnalyticsUi";

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

  it("lists rolling and lifetime presets used by the date menu", () => {
    expect(YOUTUBE_VIDEO_ANALYTICS_PRESETS.map((row) => row.id)).toEqual([
      "last_7",
      "last_28",
      "last_90",
      "last_365",
      "lifetime",
    ]);
    expect(YOUTUBE_VIDEO_ANALYTICS_PRESETS[1]).toEqual({
      id: "last_28",
      label: "Last 28 days",
      days: 28,
    });
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

  it("moves between Studio tabs in order", () => {
    expect(nextAnalyticsTab("overview", 1)).toBe("reach");
    expect(nextAnalyticsTab("audience", 1)).toBe("overview");
    expect(nextAnalyticsTab("overview", -1)).toBe("audience");
  });
});
