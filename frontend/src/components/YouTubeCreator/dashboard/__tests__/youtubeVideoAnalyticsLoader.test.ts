/**
 * Video Analytics fetch status copy — typical steps, not a live server %.
 */
import { planGenerationProgressPercent } from "../../utils/youtubePlanGenerationLoader";
import {
  YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS,
  getYouTubeVideoAnalyticsLoaderCopy,
  youtubeVideoAnalyticsProgressPercent,
} from "../youtubeVideoAnalyticsLoader";

describe("youtubeVideoAnalyticsLoader", () => {
  it("gives Overview and Audience their own titles and steps", () => {
    expect(getYouTubeVideoAnalyticsLoaderCopy("overview").title).toBe(
      "Loading channel overview",
    );
    expect(getYouTubeVideoAnalyticsLoaderCopy("audience").title).toBe(
      "Loading channel audience",
    );
    expect(getYouTubeVideoAnalyticsLoaderCopy("overview").steps).toEqual([
      "Check date range",
      "Load Analytics",
      "Show overview",
    ]);
    expect(getYouTubeVideoAnalyticsLoaderCopy("audience").steps).toEqual([
      "Check date range",
      "Load Analytics",
      "Show audience",
    ]);
    expect(getYouTubeVideoAnalyticsLoaderCopy("overview").intervalMs).toBe(
      YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS,
    );
    expect(YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS).toBe(1200);
  });

  it("reuses typical-step progress and never leaks internals", () => {
    const overview = getYouTubeVideoAnalyticsLoaderCopy("overview");
    expect(
      youtubeVideoAnalyticsProgressPercent(0, overview.messages.length),
    ).toBe(planGenerationProgressPercent(0, overview.messages.length));
    const blob = ["overview", "audience"]
      .map((fetch) => JSON.stringify(getYouTubeVideoAnalyticsLoaderCopy(fetch)))
      .join(" ");
    expect(blob.toLowerCase()).not.toMatch(/llm_text_gen|query|dimension/);
    expect(overview.hint).toMatch(/typical steps, not a live server percentage/);
  });

  it("logs unknown fetch ids without inventing a live percentage", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const copy = getYouTubeVideoAnalyticsLoaderCopy("not-a-fetch");
    expect(copy.title).toBe("");
    expect(copy.messages).toEqual([]);
    expect(copy.steps).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "[YouTubeVideoAnalytics] Progress copy unknown",
      { fetch: "not-a-fetch" },
    );
    error.mockRestore();
  });
});
