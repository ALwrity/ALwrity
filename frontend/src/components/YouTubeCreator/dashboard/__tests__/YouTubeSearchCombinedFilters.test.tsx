/**
 * Combined overlay search: one Search.list with all compatible filters.
 *
 * Hub sends searchYouTubeByOverlay. Shorts hashtag keep only when TYPE is shorts.
 * Do not restyle Disconnect, Channel Pulse, or wedges.
 */
import * as fs from "fs";
import * as path from "path";

vi.mock("../../../../services/youtubeStudioApi", () => ({
  youtubeStudioApi: {
    searchByKeyword: vi.fn(),
  },
}));

import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

const HUB_SOURCE = path.join(__dirname, "../YouTubeStudioHub.tsx");
const HUB_SEARCH_REQUESTS = path.join(
  __dirname,
  "../youtubeHubSearchRequests.ts",
);
const OVERLAY_HOOK = path.join(
  __dirname,
  "../useYouTubeStudioHubOverlaySearch.ts",
);

describe("searchYouTubeByOverlay", () => {
  async function loadRequests() {
    return import("../youtubeHubSearchRequests");
  }

  beforeEach(() => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockReset();
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: true,
      items: [{ video_id: "vid123", title: "How to train dogs" }],
    });
  });

  it("sends TYPE, Duration, Upload Date, and FEATURES in one request", async () => {
    const { searchYouTubeByOverlay } = await loadRequests();
    const result = await searchYouTubeByOverlay("dogs", {
      searchType: "videos",
      duration: "medium",
      uploadDate: "today",
      feature: "hd",
    });

    expect(youtubeStudioApi.searchByKeyword).toHaveBeenCalledTimes(1);
    const params = vi.mocked(youtubeStudioApi.searchByKeyword).mock.calls[0][0];
    expect(params.search_type).toBe("videos");
    expect(params.video_duration).toBe("medium");
    expect(params.upload_date).toBe("today");
    expect(params.video_feature).toBe("hd");
    expect(typeof params.time_zone).toBe("string");
    expect(params.time_zone?.length).toBeGreaterThan(0);
    expect(result.items).toEqual([
      { video_id: "vid123", title: "How to train dogs" },
    ]);
  });

  it("does not send Duration or FEATURES for channel search", async () => {
    const { searchYouTubeByOverlay } = await loadRequests();
    await searchYouTubeByOverlay("dogs", {
      searchType: "channel",
      uploadDate: "week",
    });

    const params = vi.mocked(youtubeStudioApi.searchByKeyword).mock.calls[0][0];
    expect(params.search_type).toBe("channel");
    expect(params.upload_date).toBe("week");
    expect(params.video_duration).toBeUndefined();
    expect(params.video_feature).toBeUndefined();
  });

  it("does not send overlay Duration when TYPE is shorts", async () => {
    const { searchYouTubeByOverlay } = await loadRequests();
    await searchYouTubeByOverlay("dogs", {
      searchType: "shorts",
      feature: "hd",
    });

    const params = vi.mocked(youtubeStudioApi.searchByKeyword).mock.calls[0][0];
    expect(params.search_type).toBe("shorts");
    expect(params.video_feature).toBe("hd");
    expect(params.video_duration).toBeUndefined();
  });

  it("applies Shorts hashtag keep only when TYPE is shorts", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: true,
      items: [
        { video_id: "plain", title: "How to train dogs" },
        { video_id: "short1", title: "Dogs #shorts" },
      ],
    });
    const { searchYouTubeByOverlay } = await loadRequests();

    const shorts = await searchYouTubeByOverlay("dogs", {
      searchType: "shorts",
    });
    expect(shorts.items).toEqual([{ video_id: "short1", title: "Dogs #shorts" }]);
    expect(shorts.message).toBeNull();

    const videos = await searchYouTubeByOverlay("dogs", {
      searchType: "videos",
      duration: "medium",
    });
    expect(videos.items).toEqual([
      { video_id: "plain", title: "How to train dogs" },
      { video_id: "short1", title: "Dogs #shorts" },
    ]);
  });

  it("returns empty results without fake hits", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: true,
      items: [],
    });
    const { searchYouTubeByOverlay } = await loadRequests();
    const result = await searchYouTubeByOverlay("dogs", {
      duration: "long",
      feature: "hd",
      uploadDate: "month",
    });

    expect(result.items).toEqual([]);
    expect(result.message).toBe("No videos found.");
  });

  it("empty overlay selection sends only the keyword", async () => {
    const { searchYouTubeByOverlay } = await loadRequests();
    await searchYouTubeByOverlay("dogs", {});

    expect(youtubeStudioApi.searchByKeyword).toHaveBeenCalledTimes(1);
    const params = vi.mocked(youtubeStudioApi.searchByKeyword).mock.calls[0][0];
    expect(params).toEqual({ q: "dogs", max_results: 25 });
  });

  it("cleared FEATURES does not send video_feature", async () => {
    const { searchYouTubeByOverlay } = await loadRequests();
    await searchYouTubeByOverlay("dogs", {
      duration: "medium",
      uploadDate: "today",
    });

    const params = vi.mocked(youtubeStudioApi.searchByKeyword).mock.calls[0][0];
    expect(params.video_duration).toBe("medium");
    expect(params.upload_date).toBe("today");
    expect(params.video_feature).toBeUndefined();
    expect(params.search_type).toBeUndefined();
  });
});

describe("Hub combined overlay wiring", () => {
  it("Hub wires combined overlay search", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("searchYouTubeByOverlay");
    expect(hub).toContain("YouTubeHubConnectButton");
  });

  it("overlay hook uses resolveYouTubeSearchOverlayCombine", () => {
    const hook = fs.readFileSync(OVERLAY_HOOK, "utf8");
    expect(hook).toContain("resolveYouTubeSearchOverlayCombine");
    expect(hook).toContain("searchYouTubeByOverlay");
  });

  it("requests export searchYouTubeByOverlay", () => {
    const requests = fs.readFileSync(HUB_SEARCH_REQUESTS, "utf8");
    expect(requests).toContain("export async function searchYouTubeByOverlay");
    expect(requests).toContain("video_feature:");
    expect(requests).toContain("upload_date:");
    expect(requests).toContain("video_duration:");
    expect(requests).toContain("search_type:");
  });
});
