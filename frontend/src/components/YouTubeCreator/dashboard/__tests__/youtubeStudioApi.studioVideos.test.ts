/**
 * Studio videos client — shared by Stale Refresh (Remarket) and Video Performance (Analysis).
 */
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { apiClient } from "../../../../api/client";

vi.mock("../../../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("youtubeStudioApi studio videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists channel videos from GET /api/youtube/studio/videos", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        videos: [{ video_id: "vid-1", title: "Rank Videos", view_count: 9 }],
      },
    });

    const result = await youtubeStudioApi.listChannelVideos({ max_results: 12 });

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/studio/videos", {
      params: { max_results: 12 },
    });
    expect(result.success).toBe(true);
    expect(result.videos[0].video_id).toBe("vid-1");
    expect(result.videos[0].view_count).toBe(9);
  });

  it("suggests stale refresh via POST /api/youtube/studio/stale-refresh/suggest", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        suggestion: { new_title: "New", new_tags: ["a"] },
      },
    });

    const result = await youtubeStudioApi.suggestStaleRefresh({
      title: "Old",
      description: "Desc",
      tags: ["seo"],
      niche: "seo",
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/youtube/studio/stale-refresh/suggest",
      {
        title: "Old",
        description: "Desc",
        tags: ["seo"],
        niche: "seo",
      },
    );
    expect(result.suggestion.new_title).toBe("New");
  });

  it("updates metadata via POST /api/youtube/studio/videos/update-metadata", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, video_id: "vid-1", message: "Metadata updated." },
    });

    const result = await youtubeStudioApi.updateVideoMetadata({
      video_id: "vid-1",
      title: "New",
      description: "Desc",
      tags: ["seo"],
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/youtube/studio/videos/update-metadata",
      {
        video_id: "vid-1",
        title: "New",
        description: "Desc",
        tags: ["seo"],
      },
    );
    expect(result.success).toBe(true);
  });
});
