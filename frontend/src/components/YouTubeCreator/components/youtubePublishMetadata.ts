/**
 * Publish metadata for Video Creator combined output.
 * Title/description come from the plan; tags come from seo_keywords.
 * Category defaults to YouTube People & Blogs (22).
 */
import type { Scene, VideoPlan } from "../../../services/youtubeApi";
import { normalizeKeywordList } from "../utils/planOutlineHelpers";

export const YOUTUBE_DEFAULT_PUBLISH_CATEGORY_ID = "22";

export const YOUTUBE_PUBLISH_CATEGORIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "1", label: "Film & Animation" },
  { id: "2", label: "Autos & Vehicles" },
  { id: "10", label: "Music" },
  { id: "15", label: "Pets & Animals" },
  { id: "17", label: "Sports" },
  { id: "19", label: "Travel & Events" },
  { id: "20", label: "Gaming" },
  { id: "22", label: "People & Blogs" },
  { id: "23", label: "Comedy" },
  { id: "24", label: "Entertainment" },
  { id: "25", label: "News & Politics" },
  { id: "26", label: "Howto & Style" },
  { id: "27", label: "Education" },
  { id: "28", label: "Science & Technology" },
];

export interface YouTubePublishMetadata {
  title: string;
  description: string;
  tags: string[];
  category_id: string;
}

const TITLE_MAX = 100;
const DEFAULT_DESCRIPTION = "Created with ALwrity YouTube Creator";

export function parseYouTubePublishTags(raw: string): string[] {
  try {
    const parts = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return normalizeKeywordList(parts);
  } catch (error) {
    console.error("[youtubePublishMetadata] Failed to parse tags", {
      errorName: error instanceof Error ? error.name : "Error",
      rawLength: raw.length,
    });
    throw error;
  }
}

function sameYouTubePublishTags(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function sameYouTubePublishMetadata(
  left: YouTubePublishMetadata,
  right: YouTubePublishMetadata,
): boolean {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.category_id === right.category_id &&
    sameYouTubePublishTags(left.tags, right.tags)
  );
}

/**
 * Keep user edits when the plan/scenes rebuild metadata.
 * Unedited fields (still equal to the previous derived snapshot) take the new plan values.
 */
export function reconcileYouTubePublishMetadata(
  current: YouTubePublishMetadata,
  previousDerived: YouTubePublishMetadata,
  nextDerived: YouTubePublishMetadata,
): YouTubePublishMetadata {
  try {
    const next: YouTubePublishMetadata = {
      title: current.title === previousDerived.title ? nextDerived.title : current.title,
      description:
        current.description === previousDerived.description
          ? nextDerived.description
          : current.description,
      tags: sameYouTubePublishTags(current.tags, previousDerived.tags)
        ? nextDerived.tags
        : current.tags,
      category_id:
        current.category_id === previousDerived.category_id
          ? nextDerived.category_id
          : current.category_id,
    };

    if (sameYouTubePublishMetadata(current, next)) {
      return current;
    }

    console.info("[youtubePublishMetadata] Reconciled publish metadata from plan", {
      titleLength: next.title.length,
      descriptionLength: next.description.length,
      tagCount: next.tags.length,
      categoryId: next.category_id,
      preservedTitle: next.title === current.title && current.title !== previousDerived.title,
      preservedDescription:
        next.description === current.description &&
        current.description !== previousDerived.description,
      preservedTags: next.tags === current.tags,
      preservedCategory:
        next.category_id === current.category_id &&
        current.category_id !== previousDerived.category_id,
    });
    return next;
  } catch (error) {
    console.error("[youtubePublishMetadata] Reconcile failed", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    throw error;
  }
}

export function buildYouTubePublishMetadata(
  videoPlan: VideoPlan | null | undefined,
  scenes: Scene[] | null | undefined,
): YouTubePublishMetadata {
  try {
    const selectedTitle = videoPlan?.selected_title?.trim();
    const summaryTitle = videoPlan?.video_summary?.trim();
    const firstSceneTitle = scenes?.find((scene) => scene.title)?.title?.trim();
    const title = (
      selectedTitle ||
      summaryTitle ||
      firstSceneTitle ||
      `ALwrity Video ${new Date().toISOString().slice(0, 10)}`
    ).slice(0, TITLE_MAX);

    const description = videoPlan?.key_message?.trim() || DEFAULT_DESCRIPTION;
    const tags = normalizeKeywordList(videoPlan?.seo_keywords || []);
    return {
      title,
      description,
      tags,
      category_id: YOUTUBE_DEFAULT_PUBLISH_CATEGORY_ID,
    };
  } catch (error) {
    console.error("[youtubePublishMetadata] Failed to build publish metadata", {
      errorName: error instanceof Error ? error.name : "Error",
      hasPlan: Boolean(videoPlan),
      sceneCount: scenes?.length ?? 0,
    });
    throw error;
  }
}

export type YouTubePublishVideoSource = "combined" | "getVideoUrl" | "scene_clip" | "none";

export function resolveYouTubePublishVideoUrl(
  finalVideoUrl: string | null | undefined,
  fallbackUrl: string | null | undefined,
  scenes: Scene[] | null | undefined,
): { url: string | null; source: YouTubePublishVideoSource } {
  try {
    if (finalVideoUrl) {
      return { url: finalVideoUrl, source: "combined" };
    }
    if (fallbackUrl) {
      return { url: fallbackUrl, source: "getVideoUrl" };
    }
    const sceneUrl =
      scenes?.find((scene) => scene.enabled !== false && scene.videoUrl)?.videoUrl ?? null;
    if (sceneUrl) {
      return { url: sceneUrl, source: "scene_clip" };
    }
    return { url: null, source: "none" };
  } catch (error) {
    console.error("[youtubePublishMetadata] Failed to resolve publish video URL", {
      errorName: error instanceof Error ? error.name : "Error",
      hasCombinedUrl: Boolean(finalVideoUrl),
      hasFallbackUrl: Boolean(fallbackUrl),
      sceneCount: scenes?.length ?? 0,
    });
    throw error;
  }
}
