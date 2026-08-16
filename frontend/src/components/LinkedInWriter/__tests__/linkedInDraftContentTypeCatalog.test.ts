import {
  DEFAULT_DRAFT_CONTENT_TYPE,
  FORMAT_TAG_BY_TYPE,
  normalizeDraftContentType,
  resolveDraftContentTypeFromAsset,
  STORAGE_CONTENT_TYPE_BY_FORMAT,
  toFormatTag,
  toStorageContentType,
} from "../utils/linkedInDraftContentTypeCatalog";

describe("linkedInDraftContentTypeCatalog", () => {
  it("maps canonical formats to storage and tag values", () => {
    expect(toStorageContentType("article")).toBe("linkedin_article");
    expect(toFormatTag("video_script")).toBe("linkedin_video_script");
    expect(STORAGE_CONTENT_TYPE_BY_FORMAT.post).toBe("linkedin_post");
    expect(FORMAT_TAG_BY_TYPE.carousel).toBe("linkedin_carousel");
  });

  it("normalizes aliases", () => {
    expect(normalizeDraftContentType("linkedin_article")).toBe("article");
    expect(normalizeDraftContentType("video")).toBe("video_script");
    expect(normalizeDraftContentType("unknown")).toBeNull();
  });

  it("defaults to post", () => {
    expect(DEFAULT_DRAFT_CONTENT_TYPE).toBe("post");
  });

  it("prefers explicit format tags over incorrect post metadata (legacy saves)", () => {
    const resolved = resolveDraftContentTypeFromAsset({
      source_module: "linkedin_writer",
      asset_type: "text",
      tags: ["linkedin", "social_media", "linkedin_article"],
      asset_metadata: { content_type: "linkedin_post" },
    });
    expect(resolved).toBe("article");
  });

  it("resolves legacy plain article tag over incorrect post metadata", () => {
    const resolved = resolveDraftContentTypeFromAsset({
      source_module: "linkedin_writer",
      asset_type: "text",
      tags: ["ai_generated", "article"],
      asset_metadata: { content_type: "linkedin_post" },
    });
    expect(resolved).toBe("article");
  });

  it("prefers linkedin_* tag over legacy plain tag when both exist", () => {
    const resolved = resolveDraftContentTypeFromAsset({
      source_module: "linkedin_writer",
      asset_type: "text",
      tags: ["carousel", "linkedin_article"],
      asset_metadata: { content_type: "linkedin_post" },
    });
    expect(resolved).toBe("article");
  });

  it("uses metadata when tags have no explicit format", () => {
    const resolved = resolveDraftContentTypeFromAsset({
      source_module: "linkedin_writer",
      asset_type: "text",
      tags: ["social_media"],
      asset_metadata: { content_type: "linkedin_carousel" },
    });
    expect(resolved).toBe("carousel");
  });
});
