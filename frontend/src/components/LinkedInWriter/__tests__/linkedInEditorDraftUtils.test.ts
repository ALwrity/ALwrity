/**
 * Assistive Writing Editor draft split/merge — text + image blocks.
 */

import {
  createEditorImageBlock,
  mergeAssistiveEditorDraft,
  splitDraftForAssistiveEditor,
} from "../utils/linkedInEditorDraftUtils";

describe("linkedInEditorDraftUtils (assistive editor)", () => {
  const imageUrl = "http://localhost:8000/api/linkedin/images/img-123";

  it("splits draft text from LinkedIn image markdown", () => {
    const draft = `Hello LinkedIn\n\n![Generated LinkedIn image](${imageUrl})\n`;
    const parsed = splitDraftForAssistiveEditor(draft);

    expect(parsed.textContent).toBe("Hello LinkedIn");
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0].imageId).toBe("img-123");
    expect(parsed.images[0].url).toBe(imageUrl);
  });

  it("merges text and images back into draft markdown", () => {
    const block = createEditorImageBlock(imageUrl, "img-123", "Post image");
    const merged = mergeAssistiveEditorDraft("Ship thoughtful posts.", [block]);

    expect(merged).toContain("Ship thoughtful posts.");
    expect(merged).toContain(`![Post image](${imageUrl})`);
  });

  it("round-trips text + image through split then merge", () => {
    const block = createEditorImageBlock(imageUrl, "img-123");
    const original = mergeAssistiveEditorDraft("Round trip body", [block]);
    const parsed = splitDraftForAssistiveEditor(original);
    const again = mergeAssistiveEditorDraft(parsed.textContent, parsed.images);

    expect(parsed.textContent).toBe("Round trip body");
    expect(parsed.images).toHaveLength(1);
    expect(again).toContain("Round trip body");
    expect(again).toContain("img-123");
  });

  it("returns text only when no images are attached", () => {
    expect(mergeAssistiveEditorDraft("Just text", [])).toBe("Just text");
    expect(splitDraftForAssistiveEditor("Just text").images).toHaveLength(0);
  });
});
