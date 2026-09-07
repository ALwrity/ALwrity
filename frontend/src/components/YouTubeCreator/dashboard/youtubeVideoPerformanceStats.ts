/**
 * Video Performance list helpers — public Data API fields only.
 * Likes per 1,000 views is a density proxy, never CTR.
 */

export type YouTubeVideoPerformanceSort = "views" | "newest";

/** Accessible tooltip + label for the compact watch icon. */
export const YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL = "view video on youtube";

export type YouTubeVideoPerformanceRow = {
  video_id?: string;
  title?: string;
  view_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  published_at?: string | null;
  thumbnail?: string | null;
};

export function formatPublicCount(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export function formatPublishedDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value.slice(0, 10);
}

export function likesPerThousandViews(
  likeCount: number | null | undefined,
  viewCount: number | null | undefined,
): string {
  if (typeof likeCount !== "number" || Number.isNaN(likeCount)) {
    return "—";
  }
  if (typeof viewCount !== "number" || Number.isNaN(viewCount) || viewCount <= 0) {
    return "—";
  }
  return ((likeCount / viewCount) * 1000).toFixed(1);
}

function viewRank(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Number.NEGATIVE_INFINITY;
  }
  return value;
}

function publishedRank(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

export function sortChannelVideos(
  videos: YouTubeVideoPerformanceRow[],
  sort: YouTubeVideoPerformanceSort,
): YouTubeVideoPerformanceRow[] {
  const copy = [...videos];
  copy.sort((a, b) => {
    if (sort === "views") {
      const viewDiff = viewRank(b.view_count) - viewRank(a.view_count);
      if (viewDiff !== 0) {
        return viewDiff;
      }
    }
    const publishedDiff = publishedRank(b.published_at) - publishedRank(a.published_at);
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    return (a.video_id || "").localeCompare(b.video_id || "");
  });
  return copy;
}

export function pickMostViewedVideo(
  videos: YouTubeVideoPerformanceRow[],
): YouTubeVideoPerformanceRow | null {
  if (videos.length === 0) {
    return null;
  }
  return sortChannelVideos(videos, "views")[0] ?? null;
}
