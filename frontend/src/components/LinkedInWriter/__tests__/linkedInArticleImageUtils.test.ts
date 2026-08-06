/**
 * linkedInArticleImageUtils unit tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInArticleImageUtils
 */

import { createEditorImageBlock } from "../utils/linkedInEditorDraftUtils";
import {
  appendImageToArticleDraftState,
  createArticleImageBlockFromUrl,
  migrateArticleCoverToImages,
  removeImageFromArticleDraftState,
} from "../utils/linkedInArticleImageUtils";
import { articleStateToMarkdown } from "../utils/linkedInArticleDraftUtils";

const baseState = {
  title: "Sample Article",
  sections: [
    { id: "s1", heading: "Introduction", body: "Opening paragraph." },
  ],
  imageSuggestions: [],
};

describe("linkedInArticleImageUtils", () => {
  test("appendImageToArticleDraftState adds image block", () => {
    const block = createEditorImageBlock(
      "https://example.com/api/linkedin/images/img_1",
      "img_1",
      "Article image",
    );
    const next = appendImageToArticleDraftState(baseState, block);
    expect(next.images).toHaveLength(1);
    expect(next.images?.[0].imageId).toBe("img_1");
  });

  test("removeImageFromArticleDraftState removes by id", () => {
    const block = createEditorImageBlock(
      "https://example.com/api/linkedin/images/img_1",
      "img_1",
    );
    const withImage = appendImageToArticleDraftState(baseState, block);
    const next = removeImageFromArticleDraftState(withImage, block.id);
    expect(next.images).toHaveLength(0);
  });

  test("migrateArticleCoverToImages moves cover into images strip", () => {
    const migrated = migrateArticleCoverToImages({
      ...baseState,
      coverImageUrl: "https://example.com/api/linkedin/images/cover_1",
    });
    expect(migrated.coverImageUrl).toBeUndefined();
    expect(migrated.images).toHaveLength(1);
  });

  test("articleStateToMarkdown appends images like post editor", () => {
    const block = createArticleImageBlockFromUrl(
      "https://example.com/api/linkedin/images/img_99",
      "Article image",
    );
    const markdown = articleStateToMarkdown(
      appendImageToArticleDraftState(baseState, block),
    );
    expect(markdown).toContain("# Sample Article");
    expect(markdown).toContain("![Article image]");
    expect(markdown).toContain("img_99");
    expect(markdown).not.toContain("Cover image");
  });
});
