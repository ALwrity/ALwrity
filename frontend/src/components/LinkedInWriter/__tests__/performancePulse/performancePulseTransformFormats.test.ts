import {
  getPerformancePulseTransformFormats,
  isPerformancePulseTransformLocked,
} from "../../components/dashboard/performancePulse/performancePulseTransformFormats";

describe("performancePulseTransformFormats", () => {
  it("lists Article → Video Script → Carousel for post sources", () => {
    expect(getPerformancePulseTransformFormats("post").map((f) => f.type)).toEqual([
      "article",
      "video_script",
      "carousel",
    ]);
    expect(getPerformancePulseTransformFormats("post").map((f) => f.label)).toEqual([
      "Article",
      "Video Script",
      "Carousel",
    ]);
  });

  it("excludes the source format while preserving order", () => {
    expect(getPerformancePulseTransformFormats("article").map((f) => f.type)).toEqual([
      "video_script",
      "carousel",
    ]);
  });

  it("locks Video Script and Carousel on the frontend", () => {
    expect(isPerformancePulseTransformLocked("video_script")).toBe(true);
    expect(isPerformancePulseTransformLocked("carousel")).toBe(true);
    expect(isPerformancePulseTransformLocked("article")).toBe(false);

    const postTargets = getPerformancePulseTransformFormats("post");
    expect(postTargets.find((f) => f.type === "video_script")?.locked).toBe(true);
    expect(postTargets.find((f) => f.type === "carousel")?.locked).toBe(true);
    expect(postTargets.find((f) => f.type === "article")?.locked).toBe(false);
  });
});
