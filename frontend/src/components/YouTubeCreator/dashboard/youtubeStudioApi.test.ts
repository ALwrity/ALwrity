import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import { apiClient } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("youtubeStudioApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads channel pulse from /api/youtube/analytics/pulse", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: false, message: "Reconnect YouTube with Analytics scope" },
    });
    const result = await youtubeStudioApi.getChannelPulse({ days: 28 });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/analytics/pulse", {
      params: { days: 28 },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Analytics/i);
  });

  it("loads comment inbox from /api/youtube/comments/inbox", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, comments: [] },
    });
    const result = await youtubeStudioApi.getCommentInbox({ max_results: 20 });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/comments/inbox", {
      params: { max_results: 20 },
    });
    expect(result.comments).toEqual([]);
  });

  it("searches by keyword via GET /api/youtube/search", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        items: [{ video_id: "vid123", title: "How to train dogs" }],
        next_page_token: "CAUQAA",
      },
    });
    const result = await youtubeStudioApi.searchByKeyword({ q: "dogs", max_results: 25 });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25 },
    });
    expect(result.items[0].video_id).toBe("vid123");
    expect(result.items[0].title).toBe("How to train dogs");
  });

  it("forwards order and event_type for Recently uploaded and Live", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, items: [] },
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      order: "date",
      event_type: "live",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: {
        q: "dogs",
        max_results: 25,
        order: "date",
        event_type: "live",
      },
    });
  });

  it("forwards video_duration=short for the Shorts Search.list filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, items: [] },
    });
    await youtubeStudioApi.searchByKeyword({
      q: "goa",
      max_results: 25,
      video_duration: "short",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "goa", max_results: 25, video_duration: "short" },
    });
  });

  it("forwards video_duration medium and long for the Duration Search.list filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, items: [] },
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_duration: "medium",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_duration: "long",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_duration: "medium" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_duration: "long" },
    });
  });
});
