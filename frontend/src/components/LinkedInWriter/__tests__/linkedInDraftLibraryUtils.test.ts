/**
 * Unit tests for My Drafts library filtering helpers.
 */

import {
  filterCompleteLinkedInDrafts,
  getDraftContentType,
  isCompleteLinkedInDraft,
  type LinkedInDraftAsset,
} from "../utils/linkedInDraftLibraryUtils";

const completePost = (overrides: Partial<LinkedInDraftAsset> = {}): LinkedInDraftAsset => ({
  id: "1",
  title: "AI trends in SaaS",
  description: "",
  created_at: "2026-08-01T00:00:00Z",
  prompt: "AI trends in SaaS",
  source_module: "linkedin_writer",
  asset_type: "text",
  asset_metadata: {
    content_type: "linkedin_post",
    content:
      "Artificial intelligence is reshaping SaaS products across onboarding, support, and analytics. Teams that ship faster with AI copilots are winning retention.",
    word_count: 22,
  },
  ...overrides,
});

describe("linkedInDraftLibraryUtils", () => {
  test("getDraftContentType maps linkedin_post to post", () => {
    expect(getDraftContentType(completePost())).toBe("post");
  });

  test("getDraftContentType maps linkedin_article metadata to article", () => {
    expect(
      getDraftContentType(
        completePost({
          asset_metadata: {
            content_type: "linkedin_article",
            content: completePost().asset_metadata?.content,
            word_count: 22,
          },
        }),
      ),
    ).toBe("article");
  });

  test("getDraftContentType prefers linkedin_article tag over wrong post metadata", () => {
    expect(
      getDraftContentType(
        completePost({
          tags: ["linkedin", "social_media", "linkedin_article"],
          asset_metadata: {
            content_type: "linkedin_post",
            content: completePost().asset_metadata?.content,
            word_count: 800,
          },
        }),
      ),
    ).toBe("article");
  });

  test("isCompleteLinkedInDraft accepts post with topic and body", () => {
    expect(isCompleteLinkedInDraft(completePost())).toBe(true);
  });

  test("isCompleteLinkedInDraft rejects title-only stub", () => {
    expect(
      isCompleteLinkedInDraft(
        completePost({
          asset_metadata: { content: "AI trends in SaaS", word_count: 3 },
        }),
      ),
    ).toBe(false);
  });

  test("isCompleteLinkedInDraft rejects unsupported formats", () => {
    expect(
      isCompleteLinkedInDraft(
        completePost({
          asset_metadata: {
            content_type: "linkedin_image",
            content: "x".repeat(120),
            word_count: 20,
          },
        }),
      ),
    ).toBe(false);
  });

  test("filterCompleteLinkedInDrafts returns newest complete drafts up to limit", () => {
    const drafts = [
      completePost({ id: "1" }),
      completePost({ id: "2", title: "Short", asset_metadata: { content: "too short" } }),
      completePost({ id: "3", title: "Second complete topic", prompt: "Second complete topic" }),
    ];
    const filtered = filterCompleteLinkedInDrafts(drafts, 2);
    expect(filtered.map((d) => d.id)).toEqual(["1", "3"]);
  });
});
