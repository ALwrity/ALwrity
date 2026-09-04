/**
 * Display label for which video a comment belongs to.
 * Uses API video_title; never invents a fake title.
 */
import { youtubeCommentVideoHeading } from "../youtubeCommentVideoHeading";

describe("youtubeCommentVideoHeading", () => {
  it("uses the API video title when present", () => {
    expect(
      youtubeCommentVideoHeading({
        video_title: "Rank Videos in 7 Days",
        video_id: "abcdefghijk",
      }),
    ).toBe("Rank Videos in 7 Days");
  });

  it("falls back to a short video id, not a fake title", () => {
    expect(
      youtubeCommentVideoHeading({
        video_title: "abcdefgh",
        video_id: "abcdefghijk",
      }),
    ).toBe("abcdefgh");
    expect(
      youtubeCommentVideoHeading({
        video_id: "abcdefghijk",
      }),
    ).toBe("abcdefgh");
    expect(
      youtubeCommentVideoHeading({
        video_id: "abcdefghijk",
        video_title: "abcdefghijk",
      }),
    ).toBe("abcdefgh");
  });

  it("does not invent a title when video id is missing", () => {
    expect(youtubeCommentVideoHeading({})).toBe("Video unavailable");
    expect(youtubeCommentVideoHeading({ video_title: "  " })).toBe("Video unavailable");
  });
});
