/**
 * Hub header search bar calls YouTube Data API v3 Search.list by keyword.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeStudioLandingHeader } from "../YouTubeStudioLandingHeader";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

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

  it("shows Search.list video titles after Enter", async () => {
    vi.mocked(youtubeStudioApi.searchByKeyword).mockResolvedValue({
      success: true,
      items: [{ video_id: "vid123", title: "How to train dogs" }],
    });

    render(<YouTubeStudioLandingHeader />);
    const field = screen.getByRole("searchbox", { name: /search youtube/i });
    fireEvent.change(field, { target: { value: "dogs" } });
    fireEvent.keyDown(field, { key: "Enter" });

    const link = await screen.findByRole("link", { name: "How to train dogs" });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=vid123");
    expect(youtubeStudioApi.searchByKeyword).toHaveBeenCalledWith({
      q: "dogs",
      max_results: 25,
    });
  });

  it("shows the API error without fake videos when not connected", async () => {
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

    expect(
      await screen.findByText("Connect YouTube to search videos."),
    ).toBeTruthy();
    expect(screen.queryByText("Searching...")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
