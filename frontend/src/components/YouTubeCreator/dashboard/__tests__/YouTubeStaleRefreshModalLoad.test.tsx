/**
 * Remarket Stale Refresh — load published videos for HITL metadata rewrite.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { StaleRefreshModal } from "../modals/StaleRefreshModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      ...actual.youtubeStudioApi,
      listChannelVideos: vi.fn(),
      suggestStaleRefresh: vi.fn(),
      updateVideoMetadata: vi.fn(),
    },
  };
});

const mockedStudioApi = vi.mocked(youtubeStudioApi);

function renderStale(open = true) {
  return render(
    <StaleRefreshModal open={open} onClose={vi.fn()} niche="seo" />,
  );
}

describe("YouTube Stale Refresh modal load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not list channel videos when closed", () => {
    mockedStudioApi.listChannelVideos.mockResolvedValue({
      success: true,
      videos: [],
    });
    renderStale(false);

    expect(mockedStudioApi.listChannelVideos).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Stale Video Refresh" })).toBeNull();
  });

  it("lists up to 12 channel videos when opened", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [
        {
          video_id: "vid-1",
          title: "Rank Videos in 7 Days",
          view_count: 1200,
        },
      ],
      message: "Loaded 1 videos.",
    });
    renderStale();

    expect(screen.getByRole("dialog", { name: "Stale Video Refresh" })).toBeTruthy();
    expect(screen.getByText(/Working/i)).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Rank Videos in 7 Days · 1200 views" }),
      ).toBeTruthy();
    });
    expect(mockedStudioApi.listChannelVideos).toHaveBeenCalledWith({ max_results: 12 });
  });

  it("shows ? views when view_count is missing", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [{ video_id: "vid-2", title: "No stats yet" }],
    });
    renderStale();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "No stats yet · ? views" })).toBeTruthy();
    });
  });

  it("shows unsuccessful list message without inventing videos", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: false,
      error_code: "not_connected",
      message: "Connect YouTube first.",
      videos: [],
    });
    renderStale();

    await waitFor(() => {
      expect(screen.getByText("Connect YouTube first.")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /views$/i })).toBeNull();
  });

  it("shows thrown list error without status-code payload as video rows", async () => {
    mockedStudioApi.listChannelVideos.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderStale();

    await waitFor(() => {
      expect(screen.getByText("Request failed with status code 503")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /views$/i })).toBeNull();
  });
});
