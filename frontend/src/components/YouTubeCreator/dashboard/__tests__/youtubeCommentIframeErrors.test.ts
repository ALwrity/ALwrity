/**
 * Documented YouTube IFrame onError codes → user-safe copy.
 */
import { userSafeYouTubeIframeError } from "../youtubeCommentIframeErrors";

describe("userSafeYouTubeIframeError", () => {
  it("maps documented iframe error codes without leaking the code", () => {
    expect(userSafeYouTubeIframeError(100)).toBe("This video is unavailable.");
    expect(userSafeYouTubeIframeError(101)).toBe(
      "This video cannot be played here.",
    );
    expect(userSafeYouTubeIframeError(150)).toBe(
      "This video cannot be played here.",
    );
    expect(userSafeYouTubeIframeError(2)).toBe(
      "This video could not be played here.",
    );
    expect(userSafeYouTubeIframeError(5)).toBe(
      "This video could not be played here.",
    );
    expect(userSafeYouTubeIframeError(153)).toBe(
      "This video could not be played here.",
    );
    expect(userSafeYouTubeIframeError(101)).not.toContain("101");
    expect(userSafeYouTubeIframeError(153)).not.toContain("153");
  });
});
