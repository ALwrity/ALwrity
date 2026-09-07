/**
 * Analysis Video Performance modal — Hub cards with public upload stats.
 * Does not open Stale Refresh HITL (Remarket).
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  thumbnail: "https://i.ytimg.com/vi/vid-1/mqdefault.jpg",
};

const newerLow = {
  video_id: "vid-2",
  title: "Quick Short",
  view_count: 80,
  like_count: 4,
  comment_count: 1,
  published_at: "2024-06-15T00:00:00Z",
};

function renderPerformance(open = true) {
  return render(<YouTubeVideoPerformanceModal open={open} onClose={vi.fn()} />);
}

function videoCard(title: string) {
  return screen.getByRole("article", { name: title });
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

  it("lists up to 50 channel videos when opened", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
      message: "Loaded 1 videos.",
    });
    renderPerformance();

    expect(screen.getByRole("dialog", { name: "Video Performance" })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Rank Videos in 7 Days" })).toBeTruthy();
    });
    expect(mockedStudioApi.listChannelVideos).toHaveBeenCalledWith({ max_results: 50 });
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
  });

  it("shows read-only stats on the card without a click and never applies metadata", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    renderPerformance();

    await waitFor(() => {
      expect(videoCard("Rank Videos in 7 Days")).toBeTruthy();
    });
    const card = videoCard("Rank Videos in 7 Days");
    expect(within(card).getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent(
      "1.2K",
    );
    expect(within(card).getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent(
      "10",
    );
    expect(within(card).getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
      "2",
    );
    expect(within(card).getByText("Published").closest(".yt-rail-stat-row")).toHaveTextContent(
      "2024-01-01",
    );
    expect(within(card).getByText("Likes per 1,000 views").closest(".yt-rail-stat-row"))
      .toHaveTextContent("8.3");
    expect(screen.queryByRole("button", { name: "Apply to YouTube (HITL)" })).toBeNull();
    expect(screen.queryByText("Suggested title")).toBeNull();
    expect(mockedStudioApi.suggestStaleRefresh).not.toHaveBeenCalled();
    expect(mockedStudioApi.updateVideoMetadata).not.toHaveBeenCalled();
  });

  it("sorts by most views by default and by newest when chosen", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [newerLow, listedVideo],
    });
    renderPerformance();

    await waitFor(() => {
      expect(videoCard("Rank Videos in 7 Days")).toBeTruthy();
    });
    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveAttribute("aria-label", "Rank Videos in 7 Days");
    expect(articles[1]).toHaveAttribute("aria-label", "Quick Short");

    fireEvent.click(screen.getByRole("button", { name: "Newest" }));

    const afterNewest = screen.getAllByRole("article");
    expect(afterNewest[0]).toHaveAttribute("aria-label", "Quick Short");
    expect(afterNewest[1]).toHaveAttribute("aria-label", "Rank Videos in 7 Days");
  });

  it("highlights the upload with the most views in this list", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [newerLow, listedVideo],
    });
    renderPerformance();

    await waitFor(() => {
      expect(screen.getByText("Most views in this list")).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: "Rank Videos in 7 Days" })).toBeTruthy();
  });

  it("shows an em dash for likes per 1,000 views when view count is zero", async () => {
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
      expect(videoCard("Brand new upload")).toBeTruthy();
    });
    const card = videoCard("Brand new upload");
    expect(within(card).getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent("0");
    expect(within(card).getByText("Likes per 1,000 views").closest(".yt-rail-stat-row"))
      .toHaveTextContent("—");
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
      expect(videoCard("Brand new upload")).toBeTruthy();
    });
    const card = videoCard("Brand new upload");
    expect(within(card).getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent("0");
    expect(within(card).getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
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
      expect(videoCard("No date")).toBeTruthy();
    });
    expect(
      within(videoCard("No date")).getByText("Published").closest(".yt-rail-stat-row"),
    ).toHaveTextContent("—");
  });

  it("still renders a card when the thumbnail URL is missing", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [{ video_id: "vid-4", title: "No thumb", view_count: 9 }],
    });
    renderPerformance();
    await waitFor(() => {
      expect(videoCard("No thumb")).toBeTruthy();
    });
    expect(within(videoCard("No thumb")).queryByRole("img")).toBeNull();
    expect(within(videoCard("No thumb")).getByText("Views")).toBeTruthy();
  });

  it("places the thumbnail in a context pane and stats in a work pane", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    renderPerformance();
    await waitFor(() => {
      expect(videoCard("Rank Videos in 7 Days")).toBeTruthy();
    });
    const card = videoCard("Rank Videos in 7 Days");
    const context = card.querySelector(".yt-video-performance-card__context");
    const work = card.querySelector(".yt-video-performance-card__work");
    const thumb = card.querySelector("img");
    expect(thumb).toBeTruthy();
    expect(card.classList.contains("yt-video-performance-card--split")).toBe(true);
    expect(context?.contains(thumb)).toBe(true);
    expect(work?.contains(thumb)).toBe(false);
    expect(work?.contains(within(card).getByRole("heading", { name: "Rank Videos in 7 Days" }))).toBe(
      true,
    );
    expect(work?.contains(within(card).getByText("Views"))).toBe(true);
    expect(context?.contains(within(card).getByText("Views"))).toBe(false);
  });

  it("lays out upload cards in a two-column list like Comment Reply split chrome", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo, newerLow],
    });
    renderPerformance();
    await waitFor(() => {
      expect(videoCard("Rank Videos in 7 Days")).toBeTruthy();
    });
    const list = document.querySelector(".yt-video-performance-list--split");
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll("article")).toHaveLength(2);
  });

  it("links to YouTube with an icon and tooltip when a video id is present", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [listedVideo],
    });
    renderPerformance();
    await waitFor(() => {
      expect(videoCard("Rank Videos in 7 Days")).toBeTruthy();
    });
    const link = within(videoCard("Rank Videos in 7 Days")).getByRole("link", {
      name: "view video on youtube",
    });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=vid-1");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("data-tooltip", "view video on youtube");
    expect(link.classList.contains("yt-video-performance-card__open")).toBe(true);
    expect(screen.queryByRole("link", { name: "Open on YouTube" })).toBeNull();
  });

  it("does not invent a YouTube watch link when video_id is missing", async () => {
    mockedStudioApi.listChannelVideos.mockResolvedValueOnce({
      success: true,
      videos: [{ title: "No id", view_count: 3 }],
    });
    renderPerformance();
    await waitFor(() => {
      expect(videoCard("No id")).toBeTruthy();
    });
    expect(
      within(videoCard("No id")).queryByRole("link", { name: "view video on youtube" }),
    ).toBeNull();
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
    expect(screen.queryByRole("article")).toBeNull();
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
    expect(screen.queryByRole("heading", { name: /Rank Videos/ })).toBeNull();
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
      expect(videoCard("No stats yet")).toBeTruthy();
    });
    const card = videoCard("No stats yet");
    expect(within(card).getByText("Views").closest(".yt-rail-stat-row")).toHaveTextContent("—");
    expect(within(card).getByText("Likes").closest(".yt-rail-stat-row")).toHaveTextContent("—");
    expect(within(card).getByText("Comments").closest(".yt-rail-stat-row")).toHaveTextContent(
      "—",
    );
    expect(screen.queryByRole("button", { name: "Apply to YouTube (HITL)" })).toBeNull();
  });
});
