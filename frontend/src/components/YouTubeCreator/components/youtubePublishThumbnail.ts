/**
 * YouTube custom thumbnail rules for Connect & Publish (phase 1 upload).
 * shorts → 9:16. medium/long → 16:9. JPEG/PNG, 2MB max.
 */

export type YouTubeThumbnailDuration = "shorts" | "medium" | "long";
export type YouTubeThumbnailAspect = "16:9" | "9:16";

export const YOUTUBE_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
export const YOUTUBE_THUMBNAIL_MIMES = ["image/jpeg", "image/png"] as const;

export const YOUTUBE_THUMBNAIL_LANDSCAPE = {
  ratio: "16:9" as const,
  width: 1280,
  height: 720,
};

export const YOUTUBE_THUMBNAIL_SHORTS = {
  ratio: "9:16" as const,
  width: 1080,
  height: 1920,
};

const RATIO_TOLERANCE = 0.03;

export function youtubePublishDurationType(
  durationType: string | undefined | null,
): YouTubeThumbnailDuration {
  if (durationType === "shorts" || durationType === "long") {
    return durationType;
  }
  return "medium";
}

export function youtubeThumbnailMimeFromFile(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type === "image/jpg" || type === "image/jpeg") {
    return "image/jpeg";
  }
  if (type === "image/png") {
    return "image/png";
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return type;
}

export function youtubeThumbnailAspectForDuration(
  durationType: YouTubeThumbnailDuration,
): YouTubeThumbnailAspect {
  return durationType === "shorts" ? "9:16" : "16:9";
}

export function youtubeThumbnailRatioMatches(
  width: number,
  height: number,
  aspect: YouTubeThumbnailAspect,
): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }
  const expected = aspect === "16:9" ? 16 / 9 : 9 / 16;
  const actual = width / height;
  return Math.abs(actual - expected) / expected <= RATIO_TOLERANCE;
}

export interface YouTubePublishThumbnailInput {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationType: YouTubeThumbnailDuration;
}

export type YouTubePublishThumbnailResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateYouTubePublishThumbnail(
  input: YouTubePublishThumbnailInput,
): YouTubePublishThumbnailResult {
  if (!YOUTUBE_THUMBNAIL_MIMES.includes(input.mimeType as (typeof YOUTUBE_THUMBNAIL_MIMES)[number])) {
    return { ok: false, error: "Please use a JPEG or PNG picture." };
  }
  if (input.sizeBytes > YOUTUBE_THUMBNAIL_MAX_BYTES) {
    return { ok: false, error: "That picture is too large. Keep it under 2 MB." };
  }
  const aspect = youtubeThumbnailAspectForDuration(input.durationType);
  if (!youtubeThumbnailRatioMatches(input.width, input.height, aspect)) {
    return {
      ok: false,
      error:
        aspect === "9:16"
          ? "Shorts need a tall picture (9:16), like 1080 × 1920."
          : "This video needs a wide picture (16:9), like 1280 × 720.",
    };
  }
  return { ok: true };
}

export function youtubeThumbnailHelperForDuration(
  durationType: YouTubeThumbnailDuration,
): string {
  return durationType === "shorts"
    ? "Shorts use a tall picture (9:16), like 1080 × 1920. JPEG or PNG, under 2 MB."
    : "Use a wide picture (16:9), like 1280 × 720. JPEG or PNG, under 2 MB.";
}

export function youtubeThumbnailNoteForDuration(
  durationType: YouTubeThumbnailDuration,
): string | null {
  if (durationType !== "shorts") {
    return null;
  }
  return (
    "On Shorts, the cover picture usually does not show inside the Shorts feed — " +
    "it appears on your channel and when the link is shared. " +
    "Your channel must be phone-verified in YouTube Studio for YouTube to accept a custom picture."
  );
}

export function youtubePublishThumbnailAppliedMessage(
  durationType: YouTubeThumbnailDuration,
): string {
  if (durationType === "shorts") {
    return (
      "We sent the cover picture to YouTube. Open the video in YouTube Studio on a computer " +
      "to confirm it — it can take a few minutes, and it may not appear where you watch Shorts."
    );
  }
  return (
    "We sent the cover picture to YouTube. Open the video in YouTube Studio to confirm it — " +
    "it can take a few minutes to show."
  );
}

export function readYouTubeThumbnailImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("We could not open that picture. Try a JPEG or PNG."));
    };
    image.src = objectUrl;
  });
}
