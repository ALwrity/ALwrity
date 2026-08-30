/**
 * useYouTubePublish — Connect / Disconnect OAuth flow (TDD).
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useYouTubePublish } from "../useYouTubePublish";
import { youtubeApi } from "../../services/youtubeApi";

vi.mock("../../services/youtubeApi", () => ({
  youtubeApi: {
    getYouTubeStatus: vi.fn(),
    getYouTubeAuthUrl: vi.fn(),
    disconnectYouTube: vi.fn(),
    startPublish: vi.fn(),
    getPublishStatus: vi.fn(),
  },
}));

const connectedChannel = {
  token_id: 42,
  channel_id: "UCabc",
  channel_name: "Studio Channel",
  expires_at: "2027-01-01T00:00:00Z",
  connected_at: "2026-01-01T00:00:00Z",
  is_active: true,
};

const disconnectedStatus = {
  success: true,
  connected: false,
  channels: [],
};

const connectedStatus = {
  success: true,
  connected: true,
  channels: [connectedChannel],
};

describe("useYouTubePublish connect/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(disconnectedStatus);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads disconnected status on mount", async () => {
    const { result } = renderHook(() => useYouTubePublish());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(youtubeApi.getYouTubeStatus).toHaveBeenCalledTimes(1);
    expect(result.current.connected).toBe(false);
    expect(result.current.activeChannel).toBeNull();
  });

  it("opens the Google OAuth popup with the backend auth URL", async () => {
    const popup = { closed: false } as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(youtubeApi.getYouTubeAuthUrl).mockResolvedValue({
      auth_url: "https://accounts.google.com/o/oauth2/auth?client_id=test",
    });

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const connectPromise = result.current.connect();
      await Promise.resolve();
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "YOUTUBE_OAUTH_SUCCESS", channel_name: "Studio Channel" },
        }),
      );
      await connectPromise;
    });

    expect(youtubeApi.getYouTubeAuthUrl).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/auth?client_id=test",
      "youtube-auth",
      expect.stringContaining("popup=1"),
    );
  });

  it("marks the channel connected after YOUTUBE_OAUTH_SUCCESS", async () => {
    vi.spyOn(window, "open").mockReturnValue({ closed: false } as Window);
    vi.mocked(youtubeApi.getYouTubeAuthUrl).mockResolvedValue({
      auth_url: "https://accounts.google.com/o/oauth2/auth",
    });
    vi.mocked(youtubeApi.getYouTubeStatus)
      .mockResolvedValueOnce(disconnectedStatus)
      .mockResolvedValue(connectedStatus);

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const connectPromise = result.current.connect();
      await Promise.resolve();
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "YOUTUBE_OAUTH_SUCCESS" } }),
      );
      await connectPromise;
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
    expect(result.current.activeChannel?.token_id).toBe(42);
    expect(result.current.activeChannel?.channel_name).toBe("Studio Channel");
  });

  it("surfaces an error when Google posts YOUTUBE_OAUTH_ERROR", async () => {
    vi.spyOn(window, "open").mockReturnValue({ closed: false } as Window);
    vi.mocked(youtubeApi.getYouTubeAuthUrl).mockResolvedValue({
      auth_url: "https://accounts.google.com/o/oauth2/auth",
    });

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const connectPromise = result.current.connect();
      await Promise.resolve();
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "YOUTUBE_OAUTH_ERROR", error: "access_denied" },
        }),
      );
      await connectPromise;
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe("access_denied");
  });

  it("fails clearly when the OAuth popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    vi.mocked(youtubeApi.getYouTubeAuthUrl).mockResolvedValue({
      auth_url: "https://accounts.google.com/o/oauth2/auth",
    });

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toMatch(/popup blocked/i);
    expect(result.current.connected).toBe(false);
  });

  it("disconnects the active token and refreshes status", async () => {
    vi.mocked(youtubeApi.getYouTubeStatus)
      .mockResolvedValueOnce(connectedStatus)
      .mockResolvedValue(disconnectedStatus);
    vi.mocked(youtubeApi.disconnectYouTube).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.disconnect(42);
    });

    expect(youtubeApi.disconnectYouTube).toHaveBeenCalledWith(42);
    await waitFor(() => {
      expect(result.current.connected).toBe(false);
    });
    expect(result.current.activeChannel).toBeNull();
  });

  it("records an error when disconnect fails", async () => {
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(connectedStatus);
    vi.mocked(youtubeApi.disconnectYouTube).mockRejectedValue(new Error("Disconnect failed"));

    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.disconnect(42);
    });

    expect(result.current.error).toBe("Disconnect failed");
    expect(result.current.connected).toBe(true);
  });
});
