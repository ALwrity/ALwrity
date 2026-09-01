/**
 * Hub Search.list requests for chip filters, TYPE, Duration, Upload Date, and Features.
 */
import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import {
  isYouTubeShortsTitle,
  type YouTubeSearchDurationFilter,
  type YouTubeSearchFeatureFilter,
  type YouTubeSearchFilter,
  type YouTubeSearchHit,
  type YouTubeSearchTypeFilter,
  type YouTubeSearchUploadDateFilter,
} from "./YouTubeSearchResultsPanel";
import { resolveYouTubeSearchTimeZone } from "./youtubeSearchTimeZone";

export type YouTubeHubSearchResult = {
  items: YouTubeSearchHit[];
  message: string | null;
};

function asHits(data: { items?: unknown }): YouTubeSearchHit[] {
  if (!Array.isArray(data.items)) {
    console.warn("[youtubeHubSearchRequests] Search response missing items array");
    return [];
  }
  return data.items as YouTubeSearchHit[];
}

export async function searchYouTubeByChip(
  query: string,
  filter: YouTubeSearchFilter,
): Promise<YouTubeHubSearchResult> {
  try {
    const params: {
      q: string;
      max_results: number;
      order?: string;
      event_type?: string;
      video_duration?: string;
    } = { q: query, max_results: 25 };
    if (filter === "recent") {
      params.order = "date";
    }
    if (filter === "live") {
      params.event_type = "live";
    }
    if (filter === "shorts") {
      params.video_duration = "short";
    }
    console.info("[youtubeHubSearchRequests] Chip search start", {
      filter,
      queryLength: query.length,
      videoDuration: params.video_duration || null,
      order: params.order || null,
      eventType: params.event_type || null,
    });
    const data = await youtubeStudioApi.searchByKeyword(params);
    if (!data?.success) {
      console.warn("[youtubeHubSearchRequests] Chip search unsuccessful", {
        filter,
        errorCode: data?.error_code || null,
      });
      return { items: [], message: data?.message || "Search failed." };
    }
    const items = asHits(data);
    if (filter === "shorts") {
      const shortsItems = items.filter((hit) => isYouTubeShortsTitle(hit.title));
      console.info("[youtubeHubSearchRequests] Chip Shorts hashtag filter", {
        before: items.length,
        after: shortsItems.length,
      });
      return {
        items: shortsItems,
        message: shortsItems.length === 0 ? "No Shorts found." : null,
      };
    }
    console.info("[youtubeHubSearchRequests] Chip search complete", {
      filter,
      itemCount: items.length,
    });
    return { items, message: items.length === 0 ? "No videos found." : null };
  } catch (error) {
    console.error("[youtubeHubSearchRequests] Chip search failed", { filter }, error);
    throw error;
  }
}

export async function searchYouTubeByType(
  query: string,
  searchType: YouTubeSearchTypeFilter,
): Promise<YouTubeHubSearchResult> {
  try {
    console.info("[youtubeHubSearchRequests] Type search start", {
      searchType,
      queryLength: query.length,
    });
    const data = await youtubeStudioApi.searchByKeyword({
      q: query,
      max_results: 25,
      search_type: searchType,
    });
    if (!data?.success) {
      console.warn("[youtubeHubSearchRequests] Type search unsuccessful", {
        searchType,
        errorCode: data?.error_code || null,
      });
      return { items: [], message: data?.message || "Search failed." };
    }
    const items = asHits(data);
    if (searchType === "shorts") {
      const shortsItems = items.filter((hit) => isYouTubeShortsTitle(hit.title));
      console.info("[youtubeHubSearchRequests] Type Shorts hashtag filter", {
        before: items.length,
        after: shortsItems.length,
      });
      return {
        items: shortsItems,
        message: shortsItems.length === 0 ? "No Shorts found." : null,
      };
    }
    console.info("[youtubeHubSearchRequests] Type search complete", {
      searchType,
      itemCount: items.length,
    });
    const emptyMessage =
      searchType === "channel"
        ? "No channels found."
        : searchType === "playlist"
          ? "No playlists found."
          : "No videos found.";
    return { items, message: items.length === 0 ? emptyMessage : null };
  } catch (error) {
    console.error(
      "[youtubeHubSearchRequests] Type search failed",
      { searchType },
      error,
    );
    throw error;
  }
}

export async function searchYouTubeByDuration(
  query: string,
  duration: YouTubeSearchDurationFilter,
): Promise<YouTubeHubSearchResult> {
  try {
    console.info("[youtubeHubSearchRequests] Duration search start", {
      videoDuration: duration,
      queryLength: query.length,
    });
    const data = await youtubeStudioApi.searchByKeyword({
      q: query,
      max_results: 25,
      video_duration: duration,
    });
    if (!data?.success) {
      console.warn("[youtubeHubSearchRequests] Duration search unsuccessful", {
        videoDuration: duration,
        errorCode: data?.error_code || null,
      });
      return { items: [], message: data?.message || "Search failed." };
    }
    const items = asHits(data);
    console.info("[youtubeHubSearchRequests] Duration search complete", {
      videoDuration: duration,
      itemCount: items.length,
    });
    return { items, message: items.length === 0 ? "No videos found." : null };
  } catch (error) {
    console.error(
      "[youtubeHubSearchRequests] Duration search failed",
      { videoDuration: duration },
      error,
    );
    throw error;
  }
}

export async function searchYouTubeByUploadDate(
  query: string,
  uploadDate: YouTubeSearchUploadDateFilter,
): Promise<YouTubeHubSearchResult> {
  let timeZone: string | null = null;
  try {
    timeZone = resolveYouTubeSearchTimeZone();
    console.info("[youtubeHubSearchRequests] Upload date search start", {
      uploadDate,
      timeZone,
      queryLength: query.length,
    });
    const data = await youtubeStudioApi.searchByKeyword({
      q: query,
      max_results: 25,
      upload_date: uploadDate,
      time_zone: timeZone,
    });
    if (!data?.success) {
      console.warn("[youtubeHubSearchRequests] Upload date search unsuccessful", {
        uploadDate,
        timeZone,
        errorCode: data?.error_code || null,
      });
      return { items: [], message: data?.message || "Search failed." };
    }
    const items = asHits(data);
    console.info("[youtubeHubSearchRequests] Upload date search complete", {
      uploadDate,
      timeZone,
      itemCount: items.length,
    });
    return { items, message: items.length === 0 ? "No videos found." : null };
  } catch (error) {
    console.error(
      "[youtubeHubSearchRequests] Upload date search failed",
      { uploadDate, timeZone, queryLength: query.length },
      error,
    );
    throw error;
  }
}

export async function searchYouTubeByFeature(
  query: string,
  feature: YouTubeSearchFeatureFilter,
): Promise<YouTubeHubSearchResult> {
  try {
    console.info("[youtubeHubSearchRequests] Feature search start", {
      videoFeature: feature,
      queryLength: query.length,
    });
    const data = await youtubeStudioApi.searchByKeyword({
      q: query,
      max_results: 25,
      video_feature: feature,
    });
    if (!data?.success) {
      console.warn("[youtubeHubSearchRequests] Feature search unsuccessful", {
        videoFeature: feature,
        errorCode: data?.error_code || null,
      });
      return { items: [], message: data?.message || "Search failed." };
    }
    const items = asHits(data);
    console.info("[youtubeHubSearchRequests] Feature search complete", {
      videoFeature: feature,
      itemCount: items.length,
    });
    return { items, message: items.length === 0 ? "No videos found." : null };
  } catch (error) {
    console.error(
      "[youtubeHubSearchRequests] Feature search failed",
      { videoFeature: feature },
      error,
    );
    throw error;
  }
}
