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
  it("exposes Studio tab order Overview, Audience, Content, Trends", () => {
    expect(YOUTUBE_VIDEO_ANALYTICS_TABS.map((tab) => tab.id)).toEqual([
      "overview",
      "audience",
      "content",
      "trends",
    ]);
    expect(YOUTUBE_VIDEO_ANALYTICS_TABS.map((tab) => tab.label)).toEqual([
      "Overview",
      "Audience",
      "Content",
      "Trends",
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
    expect(emptyAnalyticsPanelCopy("content")).toBe(
      "Content analytics is coming soon.",
    );
    expect(emptyAnalyticsPanelCopy("trends")).toBe(
      "Trends analytics is coming soon.",
    );
    expect(emptyAnalyticsPanelCopy("audience")).toBe(
      "Audience metrics will show here when analytics is connected.",
    );
    expect(emptyAnalyticsPanelCopy("content")).not.toMatch(/\d/);
    expect(emptyAnalyticsPanelCopy("overview")).not.toMatch(/\d/);
  });

  it("moves between Studio tabs in order", () => {
    expect(nextAnalyticsTab("overview", 1)).toBe("audience");
    expect(nextAnalyticsTab("trends", 1)).toBe("overview");
    expect(nextAnalyticsTab("overview", -1)).toBe("trends");
  });
});
