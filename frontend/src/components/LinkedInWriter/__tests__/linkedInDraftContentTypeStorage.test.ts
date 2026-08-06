/**
 * Unit tests for draft content type sessionStorage and event parsing helpers.
 */

import {
  clearDraftContentTypeStorage,
  contentTypeFromWriterAction,
  DRAFT_CONTENT_TYPE_SESSION_KEY,
  loadDraftContentType,
  normalizeDraftContentType,
  parseUpdateDraftDetail,
  saveDraftContentType,
} from "../utils/linkedInDraftContentTypeStorage";

describe("linkedInDraftContentTypeStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("normalizeDraftContentType", () => {
    test("accepts canonical values", () => {
      expect(normalizeDraftContentType("post")).toBe("post");
      expect(normalizeDraftContentType("article")).toBe("article");
      expect(normalizeDraftContentType("carousel")).toBe("carousel");
      expect(normalizeDraftContentType("video_script")).toBe("video_script");
    });

    test("accepts aliases", () => {
      expect(normalizeDraftContentType("linkedin_post")).toBe("post");
      expect(normalizeDraftContentType("linkedin_article")).toBe("article");
      expect(normalizeDraftContentType("video")).toBe("video_script");
    });

    test("rejects invalid values", () => {
      expect(normalizeDraftContentType("blog")).toBeNull();
      expect(normalizeDraftContentType("")).toBeNull();
      expect(normalizeDraftContentType(null)).toBeNull();
    });
  });

  describe("contentTypeFromWriterAction", () => {
    test("maps generation actions", () => {
      expect(contentTypeFromWriterAction("generateLinkedInPost")).toBe("post");
      expect(contentTypeFromWriterAction("generateLinkedInPostWithPersona")).toBe(
        "post",
      );
      expect(contentTypeFromWriterAction("generateLinkedInArticle")).toBe(
        "article",
      );
      expect(contentTypeFromWriterAction("generateLinkedInCarousel")).toBe(
        "carousel",
      );
      expect(contentTypeFromWriterAction("generateLinkedInVideoScript")).toBe(
        "video_script",
      );
    });

    test("returns null for unknown actions", () => {
      expect(contentTypeFromWriterAction("generateLinkedInOutline")).toBeNull();
      expect(contentTypeFromWriterAction(null)).toBeNull();
    });
  });

  describe("parseUpdateDraftDetail", () => {
    test("handles legacy string detail", () => {
      expect(parseUpdateDraftDetail("Hello world")).toEqual({
        content: "Hello world",
      });
    });

    test("handles object detail with contentType", () => {
      expect(
        parseUpdateDraftDetail({
          content: "# Title\n\nBody",
          contentType: "article",
        }),
      ).toEqual({
        content: "# Title\n\nBody",
        contentType: "article",
      });
    });

    test("handles object detail without contentType", () => {
      expect(parseUpdateDraftDetail({ content: "Post text" })).toEqual({
        content: "Post text",
      });
    });
  });

  describe("sessionStorage persistence", () => {
    test("save and load round-trip", () => {
      saveDraftContentType("article");
      expect(sessionStorage.getItem(DRAFT_CONTENT_TYPE_SESSION_KEY)).toBe(
        "article",
      );
      expect(loadDraftContentType()).toBe("article");
    });

    test("clear removes stored value", () => {
      saveDraftContentType("carousel");
      clearDraftContentTypeStorage();
      expect(sessionStorage.getItem(DRAFT_CONTENT_TYPE_SESSION_KEY)).toBeNull();
      expect(loadDraftContentType()).toBeNull();
    });

    test("load ignores invalid stored value", () => {
      sessionStorage.setItem(DRAFT_CONTENT_TYPE_SESSION_KEY, "invalid_type");
      expect(loadDraftContentType()).toBeNull();
    });
  });
});
