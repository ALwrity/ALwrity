import {
  buildPromptFromSelection,
  resolveLinkedInImageUrl,
  generateLinkedInImage,
  mapAspectRatioToLinkedIn,
  downloadLinkedInImageBlob,
  resolveLinkedInImageSeedText,
  LINKEDIN_IMAGE_SEED_MAX_CHARS,
  LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK,
} from "../../../services/linkedInImageService";
import { aiApiClient } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  aiApiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("../../../utils/apiUrl", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

describe("linkedInImageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildPromptFromSelection", () => {
    it("returns a LinkedIn cover seed prompt with topic and industry", () => {
      const prompt = buildPromptFromSelection(
        "AI is transforming how teams collaborate.",
        "Future of Work",
        "Technology",
      );

      expect(prompt).toContain("AI is transforming how teams collaborate.");
      expect(prompt).toContain("Topic: Future of Work.");
      expect(prompt).toContain("Industry: Technology.");
      expect(prompt).toContain(
        "Create LinkedIn post cover image for below LinkedIn post -",
      );
      expect(prompt).not.toContain(
        "Professional business aesthetic, mobile-optimized",
      );
    });

    it("keeps longer post body for cover generation (up to 1200 chars)", () => {
      const longBody = "X".repeat(1500);
      const prompt = buildPromptFromSelection(longBody, "Topic", "Industry");

      expect(prompt).toContain("X".repeat(1200));
      expect(prompt).not.toContain("X".repeat(1201));
    });
  });

  describe("resolveLinkedInImageSeedText", () => {
    it("returns trimmed text without truncating", () => {
      const longBody = "A".repeat(2500);
      expect(resolveLinkedInImageSeedText(`  ${longBody}  `)).toBe(longBody);
    });

    it("returns fallback for empty or whitespace-only input", () => {
      expect(resolveLinkedInImageSeedText("")).toBe(
        LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK,
      );
      expect(resolveLinkedInImageSeedText("   ")).toBe(
        LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK,
      );
    });

    it("exports seed max chars constant for prompt parity", () => {
      expect(LINKEDIN_IMAGE_SEED_MAX_CHARS).toBe(1200);
    });
  });

  describe("resolveLinkedInImageUrl", () => {
    it("builds correct path for image id", () => {
      expect(resolveLinkedInImageUrl("abc123")).toBe(
        "http://localhost:8000/api/linkedin/images/abc123",
      );
    });
  });

  describe("mapAspectRatioToLinkedIn", () => {
    it("maps 16:9 to LinkedIn 1.91:1 feed ratio", () => {
      expect(mapAspectRatioToLinkedIn("16:9")).toBe("1.91:1");
    });
  });

  describe("downloadLinkedInImageBlob", () => {
    it("triggers an anchor download for a blob URL", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const click = vi.fn();
      const append = vi.spyOn(document.body, "appendChild").mockImplementation(
        (node) => node,
      );
      const removeChild = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => node);
      const createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag: string) => {
          if (tag === "a") {
            return {
              href: "",
              download: "",
              click,
            } as unknown as HTMLAnchorElement;
          }
          return document.createElement(tag);
        });

      downloadLinkedInImageBlob(
        "blob:http://localhost/img",
        "linkedin-image-abc.png",
      );

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(click).toHaveBeenCalled();
      expect(append).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalled();

      createElementSpy.mockRestore();
      append.mockRestore();
      removeChild.mockRestore();
      logSpy.mockRestore();
    });

    it("throws when blobUrl is missing", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => downloadLinkedInImageBlob("", "x.png")).toThrow(
        "missing blob URL",
      );
      errorSpy.mockRestore();
    });

    it("throws when filename is blank", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() =>
        downloadLinkedInImageBlob("blob:http://localhost/img", "   "),
      ).toThrow("missing filename");
      errorSpy.mockRestore();
    });
  });

  describe("generateLinkedInImage", () => {
    it("sends model in POST body when provided", async () => {
      vi.mocked(aiApiClient.post).mockResolvedValue({
        data: { success: true, image_id: "model-test-id" },
      });

      await generateLinkedInImage({
        prompt: "Professional LinkedIn visual",
        selectedText: "Selected post excerpt.",
        topic: "Leadership",
        industry: "Business",
        model: "flux-kontext-pro",
      });

      expect(aiApiClient.post).toHaveBeenCalledWith(
        "/api/linkedin/generate-image",
        expect.objectContaining({
          model: "flux-kontext-pro",
          prompt: "Professional LinkedIn visual",
        }),
      );
    });

    it("sends gemini-3-pro-image model in POST body", async () => {
      vi.mocked(aiApiClient.post).mockResolvedValue({
        data: { success: true, image_id: "gemini-img-id" },
      });

      await generateLinkedInImage({
        prompt:
          "Create LinkedIn post cover image for below LinkedIn post -\n\nStop guessing.",
        selectedText: "Stop guessing what peers care about.",
        topic: "GSC Brainstorm",
        industry: "Manufacturing",
        model: "gemini-3-pro-image",
      });

      expect(aiApiClient.post).toHaveBeenCalledWith(
        "/api/linkedin/generate-image",
        expect.objectContaining({
          model: "gemini-3-pro-image",
          prompt: expect.stringContaining(
            "Create LinkedIn post cover image for below LinkedIn post -",
          ),
        }),
      );
    });

    it("logs URL on success", async () => {
      const consoleSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      vi.mocked(aiApiClient.post).mockResolvedValue({
        data: {
          success: true,
          image_id: "test-id-123",
        },
      });

      const result = await generateLinkedInImage({
        prompt: "Professional LinkedIn visual",
        selectedText: "Selected post excerpt for image context.",
        topic: "Leadership",
        industry: "Business",
      });

      expect(result.success).toBe(true);
      expect(result.imageId).toBe("test-id-123");
      expect(result.imageUrl).toContain("test-id-123");

      console.log(
        "[LinkedInSelectionImage] Generated image URL:",
        result.imageUrl,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[LinkedInSelectionImage] Generated image URL:",
        expect.stringContaining("test-id-123"),
      );

      consoleSpy.mockRestore();
    });

    it("returns error when API reports failure", async () => {
      vi.mocked(aiApiClient.post).mockResolvedValue({
        data: {
          success: false,
          error: "Provider unavailable",
        },
      });

      const result = await generateLinkedInImage({
        prompt: "Test prompt",
        selectedText: "Some selected text here.",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider unavailable");
    });
  });
});
