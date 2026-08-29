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
});
