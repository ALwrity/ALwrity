import {
  LINKEDIN_DEFAULT_IMAGE_MODEL,
  coerceLinkedInImageModel,
} from "../linkedInImageModelUtils";

describe("linkedInImageModelUtils", () => {
  beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses gemini-3-pro-image as the LinkedIn default model", () => {
    expect(LINKEDIN_DEFAULT_IMAGE_MODEL).toBe("gemini-3-pro-image");
  });

  it("coerces missing model to the default", () => {
    expect(coerceLinkedInImageModel()).toBe(LINKEDIN_DEFAULT_IMAGE_MODEL);
    expect(coerceLinkedInImageModel("")).toBe(LINKEDIN_DEFAULT_IMAGE_MODEL);
  });

  it("preserves supported model ids", () => {
    expect(coerceLinkedInImageModel("flux-kontext-pro")).toBe(
      "flux-kontext-pro",
    );
    expect(coerceLinkedInImageModel("gemini-3-pro-image")).toBe(
      "gemini-3-pro-image",
    );
  });

  it("falls back to default for unknown model ids", () => {
    expect(coerceLinkedInImageModel("unknown-model")).toBe(
      LINKEDIN_DEFAULT_IMAGE_MODEL,
    );
    expect(console.debug).toHaveBeenCalled();
  });
});
