/**
 * Analysis Video Performance modal — read-only upload stats.
 * Does not open Stale Refresh HITL (Remarket).
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeVideoPerformanceModal } from "../modals/YouTubeVideoPerformanceModal";
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

const listedVideo = {
  video_id: "vid-1",
  title: "Rank Videos in 7 Days",
  view_count: 1200,
  like_count: 10,
  comment_count: 2,
  published_at: "2024-01-01T00:00:00Z",
};

function renderPerformance(open = true) {
  return render(<YouTubeVideoPerformanceModal open={open} onClose={vi.fn()} />);
}

describe("YouTubeVideoPerformanceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not list channel videos when closed", () => {
    mockedStudioApi.listChannelVideos.mockResolvedValue({
      success: true,
      videos: [listedVideo],
    });
    renderPerformance(false);

    expect(mockedStudioApi.listChannelVideos).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Video Performance" })).toBeNull();
  });

  it("lists up to 12 channel videos when opened", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
      message: "Loaded 1 videos.",
    });
    renderPerformance();

    expect(screen.getByRole("dialog", { name: "Video Performance" })).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Rank Videos in 7 Days/ }),
      ).toBeTruthy();
    });
    expect(mockedStudioApi.listChannelVideos).toHaveBeenCalledWith({ max_results: 12 });
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
  });

  it("shows read-only stats for the selected video and never applies metadata", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    renderPerformance();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Rank Videos in 7 Days/ }),
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Rank Videos in 7 Days/ }));

    expect(screen.getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent(
      "1200",
    );
    expect(screen.getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent(
      "10",
    );
    expect(screen.getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
      "2",
    );
    expect(screen.getByText("Published").closest(".yt-rail-stat-row")).toHaveTextContent(
      "2024-01-01",
    );
    expect(screen.queryByRole("button", { name: "Apply to YouTube (HITL)" })).toBeNull();
    expect(screen.queryByText("Suggested title")).toBeNull();
    expect(screen.getByRole("button", { name: /Rank Videos in 7 Days/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
    expect(mockedStudioApi.updateVideoMetadata).not.toHaveBeenCalled();
  });

  it("renders zero public counts as zero, not an em dash", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [
        {
          video_id: "vid-zero",
          title: "Brand new upload",
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          published_at: "2024-03-03T12:00:00Z",
        },
      ],
    });
    renderPerformance();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Brand new upload/ })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Brand new upload/ }));

    expect(screen.getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent("0");
    expect(screen.getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent("0");
    expect(screen.getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
      "0",
    );
  });

  it("shows an em dash when published_at is missing", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [{ video_id: "vid-3", title: "No date", view_count: 4 }],
    });
    renderPerformance();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /No date/ })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /No date/ }));

    expect(screen.getByText("Published").closest(".yt-rail-stat-row")).toHaveTextContent(
      "—",
    );
  });

  it("shows Analysis back control from the wedge shell", () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [],
      message: "Loaded 0 videos.",
    });
    const onBack = vi.fn();
    render(
      <YouTubeVideoPerformanceModal
        open
        onClose={vi.fn()}
        shell={{ maxWidth: 1100, onBack, backLabel: "Analysis" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to Analysis" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows a real empty message without inventing view counts", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [],
      message: "Loaded 0 videos.",
    });
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Loaded 0 videos.")).toBeTruthy();
    });
    expect(screen.queryByText("Views")).toBeNull();
    expect(screen.queryByRole("button", { name: /views/i })).toBeNull();
  });

  it("shows unsuccessful list message without inventing videos", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: false,
      error_code: "not_connected",
      message: "Connect YouTube first.",
      videos: [],
    });
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Connect YouTube first.")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Rank Videos/ })).toBeNull();
    expect(screen.queryByText("Views")).toBeNull();
  });

  it("shows thrown list error without fake stats", async () => {
    mockedStudioApi.listChannelVideos.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Could not load videos. Please try again.")).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    expect(screen.queryByText("Views")).toBeNull();
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
  });

  it("shows an em dash for missing public stats instead of inventing zeros", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [
        {
          video_id: "vid-2",
          title: "No stats yet",
          published_at: "2024-02-02T00:00:00Z",
        },
      ],
    });
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /No stats yet/ })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /No stats yet/ }));

    expect(screen.getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent("—");
    expect(screen.getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent("—");
    expect(screen.getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
      "—",
    );
    expect(screen.queryByRole("button", { name: "Apply to YouTube (HITL)" })).toBeNull();
  });
});
