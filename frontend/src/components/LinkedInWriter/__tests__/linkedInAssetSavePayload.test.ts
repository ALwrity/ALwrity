import {
  buildLinkedInAssetFilename,
  buildLinkedInAssetSavePayload,
  resolveSaveContentType,
} from "../utils/linkedInAssetSavePayload";

describe("linkedInAssetSavePayload", () => {
  it("persists article format from contentType param", () => {
    const payload = buildLinkedInAssetSavePayload(
      {
        title: "Enterprise AI Playbook",
        content: "Long article body ".repeat(20),
        contentType: "article",
        tags: ["social_media"],
        assetMetadata: { source: "manual" },
      },
      "enterprise-ai-playbook-1.txt",
    );

    expect(payload.asset_metadata.content_type).toBe("linkedin_article");
    expect(payload.tags).toContain("linkedin_article");
    expect(payload.tags).not.toContain("linkedin_post");
    expect(payload.asset_metadata.source).toBe("manual");
  });

  it("defaults to post when contentType is omitted", () => {
    const payload = buildLinkedInAssetSavePayload(
      {
        title: "Quick update",
        content: "Short post content here for testing purposes.",
      },
      "quick-update.txt",
    );

    expect(payload.asset_metadata.content_type).toBe("linkedin_post");
    expect(payload.tags).toContain("linkedin_post");
  });

  it("content_type in payload always wins over assetMetadata", () => {
    const payload = buildLinkedInAssetSavePayload(
      {
        title: "Article",
        content: "Body",
        contentType: "article",
        assetMetadata: { content_type: "linkedin_post" },
      },
      "article.txt",
    );

    expect(payload.asset_metadata.content_type).toBe("linkedin_article");
  });

  it("resolveSaveContentType prefers explicit contentType", () => {
    expect(
      resolveSaveContentType("carousel", ["linkedin_post"], {
        content_type: "linkedin_post",
      }),
    ).toBe("carousel");
  });

  it("buildLinkedInAssetFilename slugifies title", () => {
    expect(buildLinkedInAssetFilename("Hello World!")).toMatch(
      /^hello-world-\d+\.txt$/,
    );
  });
});
