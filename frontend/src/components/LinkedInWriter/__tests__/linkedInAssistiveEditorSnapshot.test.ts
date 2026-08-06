/**
 * linkedInAssistiveEditorSnapshot tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInAssistiveEditorSnapshot
 */

import { buildAssistiveEditorSnapshotFromDraft } from "../utils/linkedInAssistiveEditorSnapshot";
import { normalizeLinkedInPostSpacing } from "../utils/linkedInPostSpacing";

describe("linkedInAssistiveEditorSnapshot", () => {
  const denseWall =
    "AI is changing work faster than most teams expected. Leaders who adapt early keep their edge. Here is how we ship thoughtful posts every week without burning out the whole content org or losing LinkedIn reach.";

  test("preserves tight single line breaks (does not auto-expand spacing)", () => {
    const tight = "First paragraph\nSecond paragraph\nThird paragraph";
    const snapshot = buildAssistiveEditorSnapshotFromDraft(tight);
    expect(snapshot.text).toBe(tight);
    expect(snapshot.text).not.toContain("\n\n");
  });

  test("preserves user-deleted blank lines on remount-style rebuild", () => {
    const spaced = "Hook line\n\nBody paragraph.\n\nCTA?";
    const userTightened = "Hook line\nBody paragraph.\nCTA?";
    const snapshot = buildAssistiveEditorSnapshotFromDraft(userTightened);
    expect(snapshot.text).toBe(userTightened);
    expect(normalizeLinkedInPostSpacing(spaced)).not.toBe(userTightened);
  });

  test("does not normalize dense AI walls when building editor snapshot", () => {
    const snapshot = buildAssistiveEditorSnapshotFromDraft(denseWall);
    expect(snapshot.text).toBe(denseWall);
    expect(normalizeLinkedInPostSpacing(denseWall)).not.toBe(denseWall);
  });

  test("preserves paragraph gaps the author kept", () => {
    const spaced = "Line one\n\nLine two";
    const snapshot = buildAssistiveEditorSnapshotFromDraft(spaced);
    expect(snapshot.text).toBe(spaced);
  });
});
