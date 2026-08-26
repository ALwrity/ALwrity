import { renderHook, waitFor } from "@testing-library/react";
import { useAuthenticatedMediaSrc } from "./useAuthenticatedMediaSrc";
import { appendAuthTokenToUrl, fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";

vi.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: vi.fn(),
  appendAuthTokenToUrl: vi.fn(),
}));

const mockedFetchMediaBlobUrl = vi.mocked(fetchMediaBlobUrl);
const mockedAppendAuthTokenToUrl = vi.mocked(appendAuthTokenToUrl);

describe("useAuthenticatedMediaSrc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the blob URL when blob load succeeds", async () => {
    mockedFetchMediaBlobUrl.mockResolvedValueOnce("blob:scene-video");
    mockedAppendAuthTokenToUrl.mockResolvedValueOnce("/api/youtube/videos/scene.mp4?token=abc");

    const { result } = renderHook(() =>
      useAuthenticatedMediaSrc("/api/youtube/videos/scene.mp4"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.src).toBe("blob:scene-video");
    expect(result.current.error).toBeNull();
  });

  it("falls back to the authenticated URL when blob load fails with 401", async () => {
    const unauthorized = Object.assign(new Error("unauthorized"), {
      response: { status: 401 },
    });
    mockedFetchMediaBlobUrl.mockRejectedValueOnce(unauthorized);
    mockedAppendAuthTokenToUrl.mockResolvedValueOnce("/api/youtube/videos/scene.mp4?token=abc");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useAuthenticatedMediaSrc("/api/youtube/videos/scene.mp4"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.src).toBe("/api/youtube/videos/scene.mp4?token=abc");
    expect(result.current.error).toBe("Preview stream is temporarily unavailable.");
    expect(warnSpy).toHaveBeenCalledWith(
      "[useAuthenticatedMediaSrc] Blob load failed, using authenticated URL fallback",
      expect.objectContaining({
        url: "/api/youtube/videos/scene.mp4",
        status: 401,
        fallback: "token-url",
      }),
    );
    warnSpy.mockRestore();
  });

  it("does not load when disabled or url is missing", async () => {
    const { result } = renderHook(() => useAuthenticatedMediaSrc(null, false));

    expect(result.current.src).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockedFetchMediaBlobUrl).not.toHaveBeenCalled();
    expect(mockedAppendAuthTokenToUrl).not.toHaveBeenCalled();
  });
});
