import { renderHook, waitFor } from "@testing-library/react";
import { useAuthenticatedMediaSrc } from "./useAuthenticatedMediaSrc";
import { appendAuthTokenToUrl, fetchMediaBlobUrl } from "../../../utils/fetchMediaBlobUrl";

jest.mock("../../../utils/fetchMediaBlobUrl", () => ({
  fetchMediaBlobUrl: jest.fn(),
  appendAuthTokenToUrl: jest.fn(),
}));

const mockedFetchMediaBlobUrl = fetchMediaBlobUrl as jest.MockedFunction<typeof fetchMediaBlobUrl>;
const mockedAppendAuthTokenToUrl = appendAuthTokenToUrl as jest.MockedFunction<typeof appendAuthTokenToUrl>;

describe("useAuthenticatedMediaSrc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("falls back to the authenticated URL when blob load fails", async () => {
    mockedFetchMediaBlobUrl.mockRejectedValueOnce(new Error("401"));
    mockedAppendAuthTokenToUrl.mockResolvedValueOnce("/api/youtube/videos/scene.mp4?token=abc");

    const { result } = renderHook(() =>
      useAuthenticatedMediaSrc("/api/youtube/videos/scene.mp4"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.src).toBe("/api/youtube/videos/scene.mp4?token=abc");
    expect(result.current.error).toBe("Preview stream is temporarily unavailable.");
  });

  it("does not load when disabled or url is missing", async () => {
    const { result } = renderHook(() => useAuthenticatedMediaSrc(null, false));

    expect(result.current.src).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockedFetchMediaBlobUrl).not.toHaveBeenCalled();
    expect(mockedAppendAuthTokenToUrl).not.toHaveBeenCalled();
  });
});
