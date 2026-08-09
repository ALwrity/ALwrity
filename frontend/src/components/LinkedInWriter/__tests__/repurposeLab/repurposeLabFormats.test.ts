import {
  REPURPOSE_LAB_FORMATS,
  isRepurposeLabFormatLocked,
} from "../../components/dashboard/repurposeLab/repurposeLabFormats";

describe("repurposeLabFormats", () => {
  it("lists formats in New Post Angle → Article → Video Script → Carousel order", () => {
    expect(REPURPOSE_LAB_FORMATS.map((f) => f.type)).toEqual([
      "post",
      "article",
      "video_script",
      "carousel",
    ]);
    expect(REPURPOSE_LAB_FORMATS.map((f) => f.label)).toEqual([
      "New Post Angle",
      "Article",
      "Video Script",
      "Carousel",
    ]);
  });

  it("locks Video Script and Carousel on the frontend", () => {
    expect(isRepurposeLabFormatLocked("video_script")).toBe(true);
    expect(isRepurposeLabFormatLocked("carousel")).toBe(true);
    expect(isRepurposeLabFormatLocked("post")).toBe(false);
    expect(isRepurposeLabFormatLocked("article")).toBe(false);
  });

  it("uses soft tonal colors for active formats", () => {
    const post = REPURPOSE_LAB_FORMATS.find((f) => f.type === "post");
    const article = REPURPOSE_LAB_FORMATS.find((f) => f.type === "article");
    expect(post?.bg).toBe("#eff6ff");
    expect(article?.bg).toBe("#ecfdf5");
  });
});
