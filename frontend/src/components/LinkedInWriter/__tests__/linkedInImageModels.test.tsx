/**
 * Tests for LinkedIn Gemini 3 Pro Image model option in shared presets.
 * Run: npx vitest run linkedInImageModels.test.tsx --watchAll=false
 */

import {
  LINKEDIN_IMAGE_MODELS,
  LINKEDIN_RECOMMENDATIONS,
} from "../../shared/ImageGenerationPresets";
import { LINKEDIN_DEFAULT_IMAGE_MODEL } from "../../shared/linkedInImageModelUtils";

describe("LinkedIn Gemini 3 Pro Image model option", () => {
  it("includes gemini-3-pro-image in LINKEDIN_IMAGE_MODELS", () => {
    const ids = LINKEDIN_IMAGE_MODELS.map((m) => m.id);
    expect(ids).toContain("gemini-3-pro-image");
    expect(ids).toEqual(
      expect.arrayContaining([
        "flux-kontext-pro",
        "ideogram-v3-turbo",
        "qwen-image",
        "gemini-3-pro-image",
      ]),
    );
  });

  it("exposes Gemini display name and cost", () => {
    const gemini = LINKEDIN_IMAGE_MODELS.find(
      (m) => m.id === "gemini-3-pro-image",
    );
    expect(gemini).toBeDefined();
    expect(gemini?.name).toBe("Gemini 3 Pro Image");
    expect(gemini?.costPerImage).toBe("$0.14");
    expect(gemini?.description.toLowerCase()).toContain("google");
  });

  it("lists gemini-3-pro-image first as the default-friendly option", () => {
    expect(LINKEDIN_IMAGE_MODELS[0].id).toBe("gemini-3-pro-image");
    expect(LINKEDIN_DEFAULT_IMAGE_MODEL).toBe("gemini-3-pro-image");
  });

  it("mentions Gemini in model recommendations helper text", () => {
    const flatten = (node: unknown): string => {
      if (node == null || typeof node === "boolean") return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatten).join("");
      if (typeof node === "object" && node !== null && "props" in node) {
        const props = (node as { props?: { children?: unknown } }).props;
        return flatten(props?.children);
      }
      return "";
    };
    const text = flatten(LINKEDIN_RECOMMENDATIONS.model);
    expect(text).toContain("Gemini 3 Pro Image");
  });
});
