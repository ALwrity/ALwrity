/**
 * LinkedIn post spacing guard — manual edits must not be re-normalized.
 */

import {
  needsLinkedInPostSpacingNormalization,
  normalizeLinkedInPostSpacing,
  normalizeLinkedInPostSpacingIfNeeded,
} from "../utils/linkedInPostSpacing";
import {
  formatDraftForPublish,
  getDraftPlainTextForDisplay,
} from "../utils/linkedInPublishFormatters";

describe("linkedInPostSpacing", () => {
  // Guard threshold is >180 chars with almost no newlines.
  const denseWall =
    "AI is changing work faster than most teams expected. Leaders who adapt early keep their edge. Here is how we ship thoughtful posts every week without burning out the whole content org or losing LinkedIn reach.";

  it("detects dense AI walls needing normalization", () => {
    expect(denseWall.length).toBeGreaterThan(180);
    expect(needsLinkedInPostSpacingNormalization(denseWall)).toBe(true);
  });

  it("skips short single-paragraph prose", () => {
    const short = "AI is changing work. Teams that adapt win.";
    expect(needsLinkedInPostSpacingNormalization(short)).toBe(false);
  });

  it("skips normalization when author uses single line breaks", () => {
    const tight = "Line one\nLine two\nLine three";
    expect(needsLinkedInPostSpacingNormalization(tight)).toBe(false);
    expect(normalizeLinkedInPostSpacingIfNeeded(tight)).toBe(tight);
  });

  it("skips normalization when author uses paragraph breaks", () => {
    const spaced = "Hook line\n\nBody paragraph.\n\nCTA?";
    expect(needsLinkedInPostSpacingNormalization(spaced)).toBe(false);
    expect(normalizeLinkedInPostSpacingIfNeeded(spaced)).toBe(spaced);
  });

  it("still normalizes dense walls", () => {
    const normalized = normalizeLinkedInPostSpacingIfNeeded(denseWall);
    expect(normalized).not.toBe(denseWall);
    expect(normalized.split("\n\n").length).toBeGreaterThan(1);
  });

  it("preserves manual tight spacing through display and publish pipelines", () => {
    const manual = "First thought\nSecond thought\nThird thought";
    expect(getDraftPlainTextForDisplay(manual)).toBe(manual);
    expect(formatDraftForPublish(manual)).toBe(manual);
  });

  it("normalizeLinkedInPostSpacing still expands dense prose", () => {
    const result = normalizeLinkedInPostSpacing(denseWall);
    expect(result).toContain("\n\n");
  });
});
