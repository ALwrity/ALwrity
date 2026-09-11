/**
 * Analysis wedge fetch status copy — typical steps, not a live server %.
 */
import { planGenerationProgressPercent } from "../../utils/youtubePlanGenerationLoader";
import {
  YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS,
  getYouTubeAnalysisWedgeLoaderCopy,
  youtubeAnalysisWedgeProgressPercent,
} from "../youtubeAnalysisWedgeLoader";

describe("youtubeAnalysisWedgeLoader", () => {
  it("gives Channel Pulse and Video Performance their own titles and steps", () => {
    expect(getYouTubeAnalysisWedgeLoaderCopy("pulse").title).toBe(
      "Loading channel pulse",
    );
    expect(getYouTubeAnalysisWedgeLoaderCopy("performance").title).toBe(
      "Loading video performance",
    );
    expect(getYouTubeAnalysisWedgeLoaderCopy("pulse").steps).toEqual([
      "Check channel",
      "Load pulse",
      "Show stats",
    ]);
    expect(getYouTubeAnalysisWedgeLoaderCopy("performance").steps).toEqual([
      "Load uploads",
      "Read public stats",
      "Show list",
    ]);
    expect(getYouTubeAnalysisWedgeLoaderCopy("pulse").intervalMs).toBe(
      YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS,
    );
    expect(YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS).toBe(1200);
  });

  it("reuses typical-step progress and never leaks internals", () => {
    const pulse = getYouTubeAnalysisWedgeLoaderCopy("pulse");
    expect(
      youtubeAnalysisWedgeProgressPercent(0, pulse.messages.length),
    ).toBe(planGenerationProgressPercent(0, pulse.messages.length));
    const blob = ["pulse", "performance"]
      .map((fetch) => JSON.stringify(getYouTubeAnalysisWedgeLoaderCopy(fetch)))
      .join(" ");
    expect(blob.toLowerCase()).not.toMatch(/llm_text_gen|query|dimension/);
    expect(pulse.hint).toMatch(/typical steps, not a live server percentage/);
    expect(
      JSON.stringify(getYouTubeAnalysisWedgeLoaderCopy("performance")).toLowerCase(),
    ).not.toMatch(/watch time|ctr/);
  });

  it("logs unknown fetch ids without inventing a live percentage", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const copy = getYouTubeAnalysisWedgeLoaderCopy("not-a-fetch");
    expect(copy.title).toBe("");
    expect(copy.messages).toEqual([]);
    expect(copy.steps).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "[YouTubeAnalysisWedge] Progress copy unknown",
      { fetch: "not-a-fetch" },
    );
    error.mockRestore();
  });
});
