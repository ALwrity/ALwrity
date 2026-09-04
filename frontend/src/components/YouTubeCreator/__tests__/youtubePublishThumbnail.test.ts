/**
 * TDD: Connect & Publish thumbnail upload (phase 1 — file + thumbnails.set).
 * duration_type shorts → 9:16. medium/long → 16:9.
 * YouTube Data API accepts JPEG/PNG ≤ 2MB; we pick the ratio from the plan.
 * Hub wedge and Podcast Maker are out of scope.
 */
import {
  YOUTUBE_THUMBNAIL_LANDSCAPE,
  YOUTUBE_THUMBNAIL_MAX_BYTES,
  YOUTUBE_THUMBNAIL_MIMES,
  YOUTUBE_THUMBNAIL_SHORTS,
  validateYouTubePublishThumbnail,
  youtubeThumbnailAspectForDuration,
  youtubeThumbnailRatioMatches,
} from "../components/youtubePublishThumbnail";

describe("youtube thumbnail aspect from duration_type", () => {
  it("uses 9:16 for shorts and 16:9 for medium or long", () => {
    expect(youtubeThumbnailAspectForDuration("shorts")).toBe("9:16");
    expect(youtubeThumbnailAspectForDuration("medium")).toBe("16:9");
    expect(youtubeThumbnailAspectForDuration("long")).toBe("16:9");
  });

  it("documents Image Studio pixel targets (1280x720 and 1080x1920)", () => {
    expect(YOUTUBE_THUMBNAIL_LANDSCAPE).toEqual({
      ratio: "16:9",
      width: 1280,
      height: 720,
    });
    expect(YOUTUBE_THUMBNAIL_SHORTS).toEqual({
      ratio: "9:16",
      width: 1080,
      height: 1920,
    });
  });
});

describe("youtubePublishThumbnailAppliedMessage", () => {
  it("does not promise the Shorts feed will show the picture", async () => {
    const { youtubePublishThumbnailAppliedMessage } = await import(
      "../components/youtubePublishThumbnail"
    );
    const shortsCopy = youtubePublishThumbnailAppliedMessage("shorts");
    expect(shortsCopy.toLowerCase()).toContain("we sent the cover picture");
    expect(shortsCopy.toLowerCase()).toContain("youtube studio");
    expect(shortsCopy.toLowerCase()).not.toContain("shorts feed");
    expect(youtubePublishThumbnailAppliedMessage("medium")).toContain("YouTube Studio");
  });
});

describe("youtubeThumbnailNoteForDuration", () => {
  it("explains Shorts feed behavior and phone verification", async () => {
    const { youtubeThumbnailNoteForDuration } = await import(
      "../components/youtubePublishThumbnail"
    );
    const note = youtubeThumbnailNoteForDuration("shorts");
    expect(note).toContain("Shorts feed");
    expect(note?.toLowerCase()).toContain("phone-verified");
    expect(youtubeThumbnailNoteForDuration("medium")).toBeNull();
  });
});

describe("youtubeThumbnailRatioMatches", () => {
  it("accepts 16:9 landscape including 1280x720 and 1920x1080", () => {
    expect(youtubeThumbnailRatioMatches(1280, 720, "16:9")).toBe(true);
    expect(youtubeThumbnailRatioMatches(1920, 1080, "16:9")).toBe(true);
  });

  it("accepts 9:16 portrait including 1080x1920 and 720x1280", () => {
    expect(youtubeThumbnailRatioMatches(1080, 1920, "9:16")).toBe(true);
    expect(youtubeThumbnailRatioMatches(720, 1280, "9:16")).toBe(true);
  });

  it("rejects a 16:9 image when the expected ratio is 9:16", () => {
    expect(youtubeThumbnailRatioMatches(1280, 720, "9:16")).toBe(false);
  });

  it("rejects a 9:16 image when the expected ratio is 16:9", () => {
    expect(youtubeThumbnailRatioMatches(1080, 1920, "16:9")).toBe(false);
  });
});

describe("validateYouTubePublishThumbnail", () => {
  const landscapeOk = {
    mimeType: "image/jpeg",
    sizeBytes: 120_000,
    width: 1280,
    height: 720,
    durationType: "medium" as const,
  };

  it("accepts JPEG or PNG under 2MB at the duration ratio", () => {
    expect(validateYouTubePublishThumbnail(landscapeOk)).toEqual({ ok: true });
    expect(
      validateYouTubePublishThumbnail({
        ...landscapeOk,
        mimeType: "image/png",
        durationType: "long",
      }),
    ).toEqual({ ok: true });
    expect(
      validateYouTubePublishThumbnail({
        mimeType: "image/png",
        sizeBytes: 200_000,
        width: 1080,
        height: 1920,
        durationType: "shorts",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects files over 2MB, wrong type, or the other ratio", () => {
    expect(YOUTUBE_THUMBNAIL_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(YOUTUBE_THUMBNAIL_MIMES).toEqual(["image/jpeg", "image/png"]);

    expect(
      validateYouTubePublishThumbnail({
        ...landscapeOk,
        sizeBytes: YOUTUBE_THUMBNAIL_MAX_BYTES + 1,
      }).ok,
    ).toBe(false);
    expect(
      validateYouTubePublishThumbnail({
        ...landscapeOk,
        mimeType: "image/webp",
      }).ok,
    ).toBe(false);
    expect(
      validateYouTubePublishThumbnail({
        ...landscapeOk,
        durationType: "shorts",
      }).ok,
    ).toBe(false);
    expect(
      validateYouTubePublishThumbnail({
        mimeType: "image/jpeg",
        sizeBytes: 80_000,
        width: 1080,
        height: 1920,
        durationType: "medium",
      }).ok,
    ).toBe(false);
  });
});
