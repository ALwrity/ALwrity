import { youtubeApi } from "../../../services/youtubeApi";
import { apiClient } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
  aiApiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  longRunningApiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("youtubeApi OAuth client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the Google authorization URL", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { auth_url: "https://accounts.google.com/o/oauth2/auth?client_id=test" },
    });

    const result = await youtubeApi.getYouTubeAuthUrl();

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/oauth/auth/url");
    expect(result.auth_url).toContain("accounts.google.com");
  });

  it("loads connection status including channels", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        connected: true,
        channels: [{ token_id: 42, channel_name: "Studio Channel", is_active: true }],
      },
    });

    const result = await youtubeApi.getYouTubeStatus();

    expect(apiClient.get).toHaveBeenCalledWith("/api/youtube/oauth/status");
    expect(result.connected).toBe(true);
    expect(result.channels[0].token_id).toBe(42);
  });

  it("disconnects by token id", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({
      data: { success: true, message: "YouTube disconnected" },
    });

    const result = await youtubeApi.disconnectYouTube(42);

    expect(apiClient.delete).toHaveBeenCalledWith("/api/youtube/oauth/disconnect/42");
    expect(result.success).toBe(true);
  });
});
