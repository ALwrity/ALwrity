/**
 * TDD: Hub search results panel (no product code in this slice).
 *
 * Results move out of the 252px header dropdown into YouTubeStudioHub so
 * filter chips fit and an embed player can land here later.
 *
 * Search.list chips we can honor now: All, Videos, Shorts, Recently uploaded, Live.
 * Unwatched/Watched are YouTube.com history — not in this panel.
 * Embed/iframe is explicitly out of scope.
 */
import * as fs from "fs";
import * as path from "path";
import { fireEvent, render, screen } from "@testing-library/react";

const HEADER_SOURCE = path.join(__dirname, "../YouTubeStudioLandingHeader.tsx");
const HUB_SOURCE = path.join(__dirname, "../YouTubeStudioHub.tsx");
const HUB_SEARCH_REQUESTS = path.join(
  __dirname,
  "../youtubeHubSearchRequests.ts",
);

const SAMPLE_HIT = {
  video_id: "vid123",
  title: "How to train dogs",
};

describe("YouTube search results live on the Hub, not the header dropdown", () => {
  it("YouTubeStudioHub renders YouTubeSearchResultsPanel", () => {
    const source = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(source).toContain("YouTubeSearchResultsPanel");
  });

  it("renders the search panel after the left toolbar", () => {
    const source = fs.readFileSync(HUB_SOURCE, "utf8");
    const toolbarJsx = source.indexOf('className="yt-studio-hub-toolbar"');
    const panelJsx = source.lastIndexOf("<YouTubeSearchResultsPanel");
    expect(toolbarJsx).toBeGreaterThan(-1);
    expect(panelJsx).toBeGreaterThan(toolbarJsx);
  });

  it("Hub Shorts filter uses videoDuration=short and hashtag matching", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    const requests = fs.readFileSync(HUB_SEARCH_REQUESTS, "utf8");
    expect(hub).toContain("searchYouTubeByChip");
    expect(requests).toContain('video_duration = "short"');
    expect(requests).toContain("isYouTubeShortsTitle");
    expect(requests).toContain("No Shorts found.");
  });

  it("YouTubeStudioLandingHeader no longer mounts the results list", () => {
    const source = fs.readFileSync(HEADER_SOURCE, "utf8");
    expect(source).not.toContain('className="yt-search-results"');
    expect(source).not.toContain('aria-label="YouTube search results"');
  });
});

describe("YouTubeSearchResultsPanel", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  it("opens a Hub region with Search.list titles", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />,
    );

    expect(
      screen.getByRole("region", { name: /youtube search results/i }),
    ).toBeTruthy();
    const link = screen.getByRole("link", { name: SAMPLE_HIT.title });
    expect(link.getAttribute("href")).toBe(
      `https://www.youtube.com/watch?v=${SAMPLE_HIT.video_id}`,
    );
  });

  it("shows Search.list filter chips All, Videos, Shorts, Recently uploaded, Live", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    expect(screen.getByRole("button", { name: /^all$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^videos$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^shorts$/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /recently uploaded/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^live$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /unwatched/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^watched$/i })).toBeNull();
  });

  it("notifies when the Shorts filter chip is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onFilterChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^shorts$/i }));
    expect(onFilterChange).toHaveBeenCalledWith("shorts");
  });

  it("detects Shorts hashtags in Search.list titles", async () => {
    const { isYouTubeShortsTitle } = await loadPanel();
    expect(isYouTubeShortsTitle("Parasailing at Goa #shorts")).toBe(true);
    expect(isYouTubeShortsTitle("Goa #youtubeshorts")).toBe(true);
    expect(isYouTubeShortsTitle("Ride #shortvideo")).toBe(true);
    expect(isYouTubeShortsTitle("GOA #SHORTS")).toBe(true);
    expect(isYouTubeShortsTitle("How to train dogs")).toBe(false);
    expect(isYouTubeShortsTitle("")).toBe(false);
    expect(isYouTubeShortsTitle("#shortstuff")).toBe(false);
  });

  it("notifies when All, Videos, or Recently uploaded is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onFilterChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^all$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^videos$/i }));
    fireEvent.click(screen.getByRole("button", { name: /recently uploaded/i }));
    expect(onFilterChange).toHaveBeenCalledWith("all");
    expect(onFilterChange).toHaveBeenCalledWith("videos");
    expect(onFilterChange).toHaveBeenCalledWith("recent");
  });

  it("logs filter-change errors without crashing", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFilterChange={() => {
          throw new Error("filter failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^live$/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchResultsPanel] Filter change failed",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("calls onClose when Close is clicked", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onClose = vi.fn();
    render(
      <YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /close search results/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs close errors without crashing", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onClose={() => {
          throw new Error("close failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /close search results/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchResultsPanel] Close failed",
      expect.any(Error),
    );
    error.mockRestore();
  });

  it("shows No Shorts found without fake videos", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[]}
        message="No Shorts found."
      />,
    );

    expect(screen.getByText("No Shorts found.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("notifies when a filter chip is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onFilterChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^live$/i }));
    expect(onFilterChange).toHaveBeenCalledWith("live");
  });

  it("does not embed a YouTube iframe in this slice", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const { container } = render(
      <YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />,
    );

    expect(container.querySelector("iframe")).toBeNull();
  });

  it("shows the API error without fake videos", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[]}
        message="Connect YouTube to search videos."
      />,
    );

    expect(screen.getByText("Connect YouTube to search videos.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing when the panel is closed", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel isOpen={false} items={[SAMPLE_HIT]} />,
    );

    expect(
      screen.queryByRole("region", { name: /youtube search results/i }),
    ).toBeNull();
  });

  it("decodes Search.list HTML entities in titles", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[
          {
            video_id: "vid-html",
            title: "You Won&#39;t Believe Time, Cost &amp; Experience",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "You Won't Believe Time, Cost & Experience",
      }),
    ).toBeTruthy();
  });
});
