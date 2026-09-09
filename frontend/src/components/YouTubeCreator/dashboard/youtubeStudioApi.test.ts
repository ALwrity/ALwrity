import { youtubeStudioApi } from "../../../services/youtubeStudioApi";
import { apiClient } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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

  it("loads channel overview from /api/youtube/analytics/overview", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, window_days: 28, current: { views: 127 } },
    });
    const result = await youtubeStudioApi.getChannelOverview({ days: 28 });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/analytics/overview", {
      params: { days: 28 },
    });
    expect(result.current.views).toBe(127);
  });

  it("logs channel audience completion without row payloads", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        demographics: {
          rows: [{ age_group: "age18-24", gender: "female", viewer_percentage: 40 }],
        },
        devices: {
          rows: [{ device_type: "DESKTOP", watch_share_percent: 60 }],
        },
      },
    });
    await youtubeStudioApi.getChannelAudience({ days: 28 });
    expect(info.mock.calls.join(" ")).toMatch(/channel audience complete/);
    expect(info.mock.calls.join(" ")).not.toMatch(/age18-24|female|DESKTOP/);
    info.mockRestore();
  });

  it("loads channel audience from /api/youtube/analytics/audience", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, demographics: { rows: [] } },
    });
    const result = await youtubeStudioApi.getChannelAudience({ days: 28 });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/analytics/audience", {
      params: { days: 28 },
    });
    expect(result.success).toBe(true);
  });

  it("logs channel overview completion without video titles", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        views_by_day: [{ date: "2026-09-04", views: 27 }],
        top_videos: [{ video_id: "vid-secret", title: "Secret title" }],
      },
    });
    await youtubeStudioApi.getChannelOverview({ days: 28 });
    expect(info.mock.calls.join(" ")).toMatch(/channel overview complete/);
    expect(info.mock.calls.join(" ")).not.toMatch(/Secret title|vid-secret/);
    info.mockRestore();
  });

  it("logs channel overview failures without response bodies", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      name: "AxiosError",
      response: { data: { detail: "filters=video==secret" } },
    });
    await expect(youtubeStudioApi.getChannelOverview({ days: 28 })).rejects.toBeTruthy();
    expect(errorSpy.mock.calls.join(" ")).toMatch(/channel overview failed/);
    expect(errorSpy.mock.calls.join(" ")).not.toMatch(/video==|secret/);
    errorSpy.mockRestore();
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

  it("forwards upload_date for the Upload Date Search.list filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, items: [] },
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      upload_date: "today",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      upload_date: "week",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      upload_date: "month",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      upload_date: "year",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, upload_date: "today" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, upload_date: "week" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, upload_date: "month" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, upload_date: "year" },
    });
  });

  it("forwards video_feature for the FEATURES Search.list filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, items: [] },
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_feature: "live",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_feature: "hd",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_feature: "subtitles",
    });
    await youtubeStudioApi.searchByKeyword({
      q: "dogs",
      max_results: 25,
      video_feature: "creative_commons",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_feature: "live" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_feature: "hd" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_feature: "subtitles" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/search", {
      params: { q: "dogs", max_results: 25, video_feature: "creative_commons" },
    });
  });
});
