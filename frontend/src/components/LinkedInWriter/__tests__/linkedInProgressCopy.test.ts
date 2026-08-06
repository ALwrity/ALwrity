/**
 * Unit tests for LinkedIn Studio progress modal copy helpers.
 */

import {
  getProgressCompletionFooter,
  getProgressHeaderSubtitle,
  getProgressHeaderTitle,
  getProgressStepEducation,
  resolveProgressContentType,
} from "../utils/linkedInProgressCopy";

describe("linkedInProgressCopy", () => {
  describe("resolveProgressContentType", () => {
    test("returns article for article", () => {
      expect(resolveProgressContentType("article")).toBe("article");
    });

    test("returns post for post and unknown types", () => {
      expect(resolveProgressContentType("post")).toBe("post");
      expect(resolveProgressContentType("carousel")).toBe("post");
      expect(resolveProgressContentType(undefined)).toBe("post");
    });
  });

  describe("getProgressHeaderTitle", () => {
    test("active post title", () => {
      expect(
        getProgressHeaderTitle({
          active: true,
          hasError: false,
          contentType: "post",
        }),
      ).toBe("Generating Your Post");
    });

    test("active article title", () => {
      expect(
        getProgressHeaderTitle({
          active: true,
          hasError: false,
          contentType: "article",
        }),
      ).toBe("Generating Your Article");
    });

    test("error title", () => {
      expect(
        getProgressHeaderTitle({
          active: true,
          hasError: true,
          contentType: "article",
        }),
      ).toBe("Generation Failed");
    });
  });

  describe("getProgressHeaderSubtitle", () => {
    test("done subtitle mentions post vs article", () => {
      expect(
        getProgressHeaderSubtitle({
          active: false,
          hasError: false,
          contentType: "post",
        }),
      ).toContain("your post is ready");
      expect(
        getProgressHeaderSubtitle({
          active: false,
          hasError: false,
          contentType: "article",
        }),
      ).toContain("your article is ready");
    });
  });

  describe("getProgressStepEducation", () => {
    test("content_generation differs for post vs article", () => {
      const post = getProgressStepEducation("content_generation", "post");
      const article = getProgressStepEducation("content_generation", "article");
      expect(post).toContain("LinkedIn post");
      expect(article).toContain("LinkedIn article");
      expect(post).not.toBe(article);
    });
  });

  describe("getProgressCompletionFooter", () => {
    test("footer mentions post vs article", () => {
      expect(getProgressCompletionFooter("post")).toContain("post");
      expect(getProgressCompletionFooter("article")).toContain("article");
    });
  });
});
