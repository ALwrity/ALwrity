/**
 * Video Performance — leak-safe logs and user-facing errors.
 * No Stale Refresh HITL.
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

function loggedText(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call) => JSON.stringify(call)).join(" ");
}

describe("YouTubeVideoPerformanceModal errors and logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStudioApi.listChannelVideos.mockReset();
  });

  it("logs list start and complete with counts only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Rank Videos in 7 Days" }),
      ).toBeTruthy();
    });
    const text = loggedText(info);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] List start/);
    expect(text).toMatch(/"maxResults":50/);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] List complete/);
    expect(text).toMatch(/"videoCount":1/);
    expect(text.toLowerCase()).not.toMatch(/rank videos|vid-1|token|authorization/);
    info.mockRestore();
  });

  it("warns unsuccessful list with error_code and shows the API message", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: false,
      error_code: "not_connected",
      message: "Connect YouTube first.",
      videos: [],
    });
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Connect YouTube first.")).toBeTruthy();
    });
    const text = loggedText(warn);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] List unsuccessful/);
    expect(text).toMatch(/not_connected/);
    expect(text.toLowerCase()).not.toMatch(/authorization|bearer|api[_-]?key/);
    warn.mockRestore();
  });

  it("uses a generic fallback when unsuccessful list has no message", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: false,
      error_code: "list_failed",
      videos: [],
    });
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Could not load videos. Please try again.")).toBeTruthy();
    });
    expect(screen.queryByText("Views")).toBeNull();
  });

  it("logs list failure without request text and hides status codes from the user", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedStudioApi.listChannelVideos.mockRejectedValueOnce(
      new Error("Request failed with status code 503"),
    );
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Could not load videos. Please try again.")).toBeTruthy();
    });
    expect(screen.queryByText(/status code 503/i)).toBeNull();
    const text = loggedText(error);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] List failed/);
    expect(text).toMatch(/"errorName":"Error"/);
    expect(text).not.toMatch(/status code 503/);
    error.mockRestore();
  });

  it("warns invalid list payload without dumping video fields", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: null,
    });
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Could not load videos. Please try again.")).toBeTruthy();
    });
    const text = loggedText(warn);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] List unsuccessful/);
    expect(text).toMatch(/invalid_payload/);
    expect(text.toLowerCase()).not.toMatch(/vid-1|token|authorization/);
    expect(screen.queryByText("Views")).toBeNull();
    warn.mockRestore();
  });

  it("logs sort changes without titles or metadata rewrite", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    render(<YouTubeVideoPerformanceModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Rank Videos in 7 Days" }),
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Newest" }));

    const text = loggedText(info);
    expect(text).toMatch(/\[YouTubeVideoPerformance\] Sort changed/);
    expect(text).toMatch(/"sort":"newest"/);
    expect(text.toLowerCase()).not.toMatch(/rank videos|apply|suggest|vid-1/);
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
    expect(mockedStudioApi.updateVideoMetadata).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
