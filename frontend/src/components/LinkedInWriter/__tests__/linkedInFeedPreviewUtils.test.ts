/**
 * Unit tests for LinkedIn feed preview truncation helpers.
 */

import {
  getFeedCollapsedText,
  getFeedFrameWidth,
  LINKEDIN_FEED_SEE_MORE_CHARS,
} from "../utils/linkedInFeedPreviewUtils";

describe("linkedInFeedPreviewUtils", () => {
  const longText =
    "Artificial intelligence is reshaping how teams collaborate across industries. " +
    "Leaders who invest in practical AI workflows are seeing faster drafts, clearer messaging, and stronger engagement. " +
    "The question is not whether to adopt AI, but how to use it without losing your authentic voice.";

  test("does not truncate short posts", () => {
    const short = "Short LinkedIn hook.";
    const result = getFeedCollapsedText(short, "desktop", false);
    expect(result.isTruncated).toBe(false);
    expect(result.collapsedText).toBe(short);
  });

  test("truncates long posts on mobile feed fold", () => {
    const result = getFeedCollapsedText(longText, "mobile", false);
    expect(result.isTruncated).toBe(true);
    expect(result.collapsedText.length).toBeLessThanOrEqual(
      LINKEDIN_FEED_SEE_MORE_CHARS.mobile + 20,
    );
    expect(longText.startsWith(result.collapsedText.slice(0, 40))).toBe(true);
  });

  test("returns full text when expanded", () => {
    const result = getFeedCollapsedText(longText, "mobile", true);
    expect(result.isTruncated).toBe(false);
    expect(result.collapsedText).toBe(longText);
  });

  test("desktop frame is wider than mobile", () => {
    expect(getFeedFrameWidth("desktop")).toBeGreaterThan(
      getFeedFrameWidth("mobile"),
    );
  });
});
