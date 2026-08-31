/**
 * Hub header search bar calls YouTube Data API v3 Search.list by keyword.
 * Results open on the Hub panel, not this header.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeStudioLandingHeader } from "../YouTubeStudioLandingHeader";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { YT_SEARCH_RESULTS_EVENT } from "../youtubeStudioEvents";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../../shared/HeaderControls", () => ({
  default: () => <div data-testid="yt-header-controls" />,
}));

vi.mock("../../../../services/youtubeStudioApi", () => ({
  youtubeStudioApi: {
    searchByKeyword: vi.fn(),
  },
}));

describe("YouTubeStudioLandingHeader", () => {
  beforeEach(() => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockReset();
  });

  it("keeps the Creator Studio brand", () => {
    render(<YouTubeStudioLandingHeader />);
    expect(screen.getByRole("heading", { name: /YouTube/i })).toBeTruthy();
  });

  it("shows the YouTube search bar on the Hub header", () => {
    render(<YouTubeStudioLandingHeader />);
    expect(screen.getByRole("searchbox", { name: /search youtube/i })).toBeTruthy();
  });

  it("calls Search.list on Enter without rendering results in the header", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: true,
      items: [{ video_id: "vid123", title: "How to train dogs" }],
    });

    render(<YouTubeStudioLandingHeader />);
    const field = screen.getByRole("searchbox", { name: /search youtube/i });
    fireEvent.change(field, { target: { value: "dogs" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(youtubeStudioApi.searchByKeyword).toHaveBeenCalledWith({
        q: "dogs",
        max_results: 25,
      });
    });
    expect(screen.queryByRole("link", { name: "How to train dogs" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: /youtube search results/i }),
    ).toBeNull();
  });

  it("does not show fake videos in the header when not connected", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: false,
      error_code: "not_connected",
      message: "Connect YouTube to search videos.",
      items: [],
    });

    render(<YouTubeStudioLandingHeader />);
    const field = screen.getByRole("searchbox", { name: /search youtube/i });
    fireEvent.change(field, { target: { value: "dogs" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(youtubeStudioApi.searchByKeyword).toHaveBeenCalled();
    });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("publishes an empty-keyword error to the Hub without calling Search.list", async () => {
    const seen: Array<{ items: unknown[]; message: string | null }> = [];
    const onResults = (event: Event) => {
      seen.push((event as CustomEvent).detail);
    };
    window.addEventListener(YT_SEARCH_RESULTS_EVENT, onResults);

    render(<YouTubeStudioLandingHeader />);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search youtube/i }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });
    expect(youtubeStudioApi.searchByKeyword).not.toHaveBeenCalled();
    expect(seen[0].items).toEqual([]);
    expect(seen[0].message).toMatch(/keyword/i);

    window.removeEventListener(YT_SEARCH_RESULTS_EVENT, onResults);
  });

  it("publishes Search failed to the Hub when Search.list throws", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockRejectedValue(
      new Error("network down"),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const seen: Array<{ items: unknown[]; message: string | null }> = [];
    const onResults = (event: Event) => {
      seen.push((event as CustomEvent).detail);
    };
    window.addEventListener(YT_SEARCH_RESULTS_EVENT, onResults);

    render(<YouTubeStudioLandingHeader />);
    const field = screen.getByRole("searchbox", { name: /search youtube/i });
    fireEvent.change(field, { target: { value: "dogs" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(seen.some((d) => d.message === "Search failed.")).toBe(true);
    });
    expect(seen[seen.length - 1].items).toEqual([]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[YouTubeStudioLandingHeader] Search submit handler failed",
      expect.any(Error),
    );

    error.mockRestore();
    window.removeEventListener(YT_SEARCH_RESULTS_EVENT, onResults);
  });
});
