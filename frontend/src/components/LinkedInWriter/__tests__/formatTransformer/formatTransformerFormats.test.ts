import {
  FORMAT_TRANSFORMER_OPTIONS,
  isFormatTransformerLocked,
} from "../../components/dashboard/formatTransformer/formatTransformerFormats";

describe("formatTransformerFormats", () => {
  it("lists Article, Carousel, and Video Script", () => {
    expect(FORMAT_TRANSFORMER_OPTIONS.map((f) => f.label)).toEqual([
      "Article",
      "Carousel",
      "Video Script",
    ]);
  });

  it("locks Video Script and Carousel on the frontend", () => {
    expect(isFormatTransformerLocked("video_script")).toBe(true);
    expect(isFormatTransformerLocked("carousel")).toBe(true);
    expect(isFormatTransformerLocked("article")).toBe(false);
  });
});
