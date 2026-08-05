/**
 * Unit tests for LinkedIn Studio editor shell routing helpers.
 */

import { resolveEditorShellMode } from "../utils/linkedInEditorShellUtils";

describe("linkedInEditorShellUtils", () => {
  describe("resolveEditorShellMode", () => {
    test("returns article for article content type", () => {
      expect(resolveEditorShellMode("article")).toBe("article");
      expect(resolveEditorShellMode("linkedin_article")).toBe("article");
    });

    test("returns post for post and other types", () => {
      expect(resolveEditorShellMode("post")).toBe("post");
      expect(resolveEditorShellMode("linkedin_post")).toBe("post");
      expect(resolveEditorShellMode("carousel")).toBe("post");
      expect(resolveEditorShellMode("video_script")).toBe("post");
    });

    test("returns post for unknown or missing values", () => {
      expect(resolveEditorShellMode(undefined)).toBe("post");
      expect(resolveEditorShellMode(null)).toBe("post");
      expect(resolveEditorShellMode("blog")).toBe("post");
    });
  });
});
