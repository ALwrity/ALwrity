/**
 * Assistive editor highlight range helpers.
 */

import {
  getAddedTextRange,
  type AssistiveTextHighlightRange,
} from "../utils/linkedInAssistiveHighlightUtils";

describe("linkedInAssistiveHighlightUtils", () => {
  it("getAddedTextRange finds pure insertion span", () => {
    const before =
      "Imagine publishing a weekly thought-leadership piece in under 10 minutes.";
    const insertion =
      " You don't have to sacrifice quality for speed, thanks to the streamlined workflow. ";
    const after = before + insertion;

    const range = getAddedTextRange(before, after);
    expect(range).toEqual({
      start: before.length,
      end: before.length + insertion.length,
    });
  });

  it("getAddedTextRange returns null when text is unchanged", () => {
    const text = "Same content.";
    expect(getAddedTextRange(text, text)).toBeNull();
  });

  it("getAddedTextRange returns null for empty after text", () => {
    expect(getAddedTextRange("Hello", "")).toBeNull();
  });

  it("getAddedTextRange highlights assistive insert with surrounding spaces", () => {
    const before = "Imagine publishing weekly.";
    const added = " You don't sacrifice quality. ";
    const after = before + added;
    const range = getAddedTextRange(before, after) as AssistiveTextHighlightRange;
    expect(after.slice(range.start, range.end)).toBe(added);
  });
});
