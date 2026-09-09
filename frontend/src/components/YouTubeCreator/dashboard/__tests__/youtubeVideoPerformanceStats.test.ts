/**
 * Video Performance list helpers — compact counts, sort, highlight, likes per 1k.
 * Public Data API fields only. Never labeled as CTR.
 */
import {
  formatPublishedDate,
  formatPublicCount,
  likesPerThousandViews,
  pickMostViewedVideo,
  sortChannelVideos,
  YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL,
  type YouTubeVideoPerformanceRow,
} from "../youtubeVideoPerformanceStats";

const olderHigh: YouTubeVideoPerformanceRow = {
  video_id: "vid-a",
  title: "Older hit",
  view_count: 2000,
  like_count: 20,
  comment_count: 1,
  published_at: "2024-01-01T00:00:00Z",
};

const newerLow: YouTubeVideoPerformanceRow = {
  video_id: "vid-b",
  title: "Newer clip",
  view_count: 50,
  like_count: 5,
  comment_count: 0,
  published_at: "2024-06-01T00:00:00Z",
};

describe("youtubeVideoPerformanceStats", () => {
  it("exposes a stable watch-icon label for tooltips", () => {
    expect(YOUTUBE_VIDEO_PERFORMANCE_WATCH_LABEL).toBe("view video on youtube");
  });
  it("formats compact Hub-style counts and keeps zero", () => {
    expect(formatPublicCount(1200)).toBe("1.2K");
    expect(formatPublicCount(0)).toBe("0");
    expect(formatPublicCount(null)).toBe("—");
    expect(formatPublicCount(undefined)).toBe("—");
  });

  it("formats published_at as an ISO date prefix", () => {
    expect(formatPublishedDate("2024-01-01T00:00:00Z")).toBe("2024-01-01");
    expect(formatPublishedDate(null)).toBe("—");
  });

  it("computes likes per 1,000 views only when views are positive", () => {
    expect(likesPerThousandViews(10, 1200)).toBe("8.3");
    expect(likesPerThousandViews(0, 100)).toBe("0.0");
    expect(likesPerThousandViews(10, 0)).toBe("—");
    expect(likesPerThousandViews(10, null)).toBe("—");
    expect(likesPerThousandViews(null, 100)).toBe("—");
  });

  it("sorts by most views then by newest published_at", () => {
    const viewsOrder = sortChannelVideos([newerLow, olderHigh], "views");
    expect(viewsOrder.map((v) => v.video_id)).toEqual(["vid-a", "vid-b"]);

    const newestOrder = sortChannelVideos([olderHigh, newerLow], "newest");
    expect(newestOrder.map((v) => v.video_id)).toEqual(["vid-b", "vid-a"]);
  });

  it("picks the most-viewed video with newer date then video_id tie-break", () => {
    const tiedOlder: YouTubeVideoPerformanceRow = {
      video_id: "vid-z",
      title: "Tie older",
      view_count: 100,
      published_at: "2024-01-01T00:00:00Z",
    };
    const tiedNewer: YouTubeVideoPerformanceRow = {
      video_id: "vid-m",
      title: "Tie newer",
      view_count: 100,
      published_at: "2024-02-01T00:00:00Z",
    };
    expect(pickMostViewedVideo([tiedOlder, tiedNewer])?.video_id).toBe("vid-m");

    const sameDateA: YouTubeVideoPerformanceRow = {
      video_id: "vid-a",
      view_count: 9,
      published_at: "2024-03-01T00:00:00Z",
    };
    const sameDateB: YouTubeVideoPerformanceRow = {
      video_id: "vid-b",
      view_count: 9,
      published_at: "2024-03-01T00:00:00Z",
    };
    expect(pickMostViewedVideo([sameDateB, sameDateA])?.video_id).toBe("vid-a");
  });

  it("returns null highlight when the list is empty", () => {
    expect(pickMostViewedVideo([])).toBeNull();
  });

  it("treats missing view_count as lowest rank when sorting by views", () => {
    const missing: YouTubeVideoPerformanceRow = {
      video_id: "vid-n",
      view_count: null,
      published_at: "2024-08-01T00:00:00Z",
    };
    const ranked = sortChannelVideos([missing, newerLow], "views");
    expect(ranked[0].video_id).toBe("vid-b");
  });
});
