/**
 * Valid YouTube watch IDs for IFrame Player embeds.
 * https://developers.google.com/youtube/v3/docs/videos#id
 */
import { isYouTubeIframeVideoId } from "../youtubeCommentEmbedVideoId";
import { YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY } from "../youtubeCommentVideoGroups";

describe("isYouTubeIframeVideoId", () => {
  it("accepts a trimmed 11-character YouTube video id", () => {
    expect(isYouTubeIframeVideoId("abcdefghijk")).toBe(true);
    expect(isYouTubeIframeVideoId(" abcdefghijk ")).toBe(true);
    expect(isYouTubeIframeVideoId("dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects missing, short, or unavailable keys", () => {
    expect(isYouTubeIframeVideoId("")).toBe(false);
    expect(isYouTubeIframeVideoId("vid-1")).toBe(false);
    expect(isYouTubeIframeVideoId("abcdefghij")).toBe(false);
    expect(isYouTubeIframeVideoId("abcdefghijkl")).toBe(false);
    expect(isYouTubeIframeVideoId("abcdefghi!k")).toBe(false);
    expect(isYouTubeIframeVideoId(YOUTUBE_COMMENT_VIDEO_UNAVAILABLE_GROUP_KEY)).toBe(
      false,
    );
    expect(isYouTubeIframeVideoId(null)).toBe(false);
    expect(isYouTubeIframeVideoId(undefined)).toBe(false);
  });
});
