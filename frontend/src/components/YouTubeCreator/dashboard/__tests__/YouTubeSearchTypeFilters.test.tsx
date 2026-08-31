/**
 * TDD: YouTube.com Filters icon + Search filters TYPE column.
 *
 * Filters control (image 1): "Filters" label + sliders icon on the Hub
 * results panel. Click opens Search filters (image 2). This slice only
 * locks TYPE: Videos, Shorts, Channels, Playlists, Movies.
 *
 * Search.list mappings:
 *   Videos    → type=video
 *   Shorts    → type=video + videoDuration=short (hashtag keep on Hub)
 *   Channels  → type=channel
 *   Playlists → type=playlist
 *   Movies    → type=video + videoType=movie
 *
 * Out of scope here: Features, Prioritise, Unwatched/Watched.
 * Duration and Upload Date are sibling columns, not part of
 * YouTubeSearchTypeFilters. Do not change chip-row behavior.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

const SAMPLE_HIT = {
  video_id: "vid123",
  title: "How to train dogs",
};

describe("YouTube search Filters icon", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  it("shows a Filters button with a sliders icon on the results panel", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    const filters = screen.getByRole("button", { name: /^filters$/i });
    expect(filters).toBeTruthy();
    const icon = filters.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the current All, Videos, Shorts, Recently uploaded, Live chips", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    expect(screen.getByRole("button", { name: /^all$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^videos$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^shorts$/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /recently uploaded/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^live$/i })).toBeTruthy();
  });

  it("does not open Search filters until Filters is clicked", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    expect(
      screen.queryByRole("dialog", { name: /search filters/i }),
    ).toBeNull();
  });

  it("opens Search filters with TYPE Videos, Shorts, Channels, Playlists, Movies", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^type$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^videos$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^shorts$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^channels$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^playlists$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^movies$/i })).toBeTruthy();
    expect(within(dialog).queryByRole("group", { name: /^features$/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /unwatched/i })).toBeNull();
  });

  it("notifies onTypeChange from TYPE options in Search filters", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onTypeChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onTypeChange={onTypeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^videos$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^shorts$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^channels$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^playlists$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^movies$/i },
      ),
    );

    expect(onTypeChange).toHaveBeenCalledWith("videos");
    expect(onTypeChange).toHaveBeenCalledWith("shorts");
    expect(onTypeChange).toHaveBeenCalledWith("channel");
    expect(onTypeChange).toHaveBeenCalledWith("playlist");
    expect(onTypeChange).toHaveBeenCalledWith("movie");
  });

  it("closes Search filters after a TYPE option is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onTypeChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("dialog", { name: /search filters/i })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^videos$/i },
      ),
    );
    expect(
      screen.queryByRole("dialog", { name: /search filters/i }),
    ).toBeNull();
  });

  it("closes Search filters from the dialog close control", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("dialog", { name: /search filters/i })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /close search filters/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /search filters/i }),
    ).toBeNull();
  });
});

describe("YouTubeSearchTypeFilters", () => {
  async function loadTypeFilters() {
    return import("../YouTubeSearchTypeFilters");
  }

  it("shows the TYPE group with Videos, Shorts, Channels, Playlists, Movies", async () => {
    const { YouTubeSearchTypeFilters } = await loadTypeFilters();
    render(<YouTubeSearchTypeFilters />);

    expect(screen.getByRole("group", { name: /^type$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^videos$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^shorts$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^channels$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^playlists$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^movies$/i })).toBeTruthy();
  });

  it("does not show later Search filters columns or history chips", async () => {
    const { YouTubeSearchTypeFilters } = await loadTypeFilters();
    render(<YouTubeSearchTypeFilters />);

    expect(screen.queryByRole("group", { name: /^duration$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^upload date$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^features$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^prioritise$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /unwatched/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^watched$/i })).toBeNull();
  });

  it("notifies onTypeChange with Search.list type ids", async () => {
    const { YouTubeSearchTypeFilters } = await loadTypeFilters();
    const onTypeChange = vi.fn();
    render(<YouTubeSearchTypeFilters onTypeChange={onTypeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^videos$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^shorts$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^channels$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^playlists$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^movies$/i }));

    expect(onTypeChange).toHaveBeenCalledWith("videos");
    expect(onTypeChange).toHaveBeenCalledWith("shorts");
    expect(onTypeChange).toHaveBeenCalledWith("channel");
    expect(onTypeChange).toHaveBeenCalledWith("playlist");
    expect(onTypeChange).toHaveBeenCalledWith("movie");
  });

  it("logs TYPE change errors without crashing", async () => {
    const { YouTubeSearchTypeFilters } = await loadTypeFilters();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(
      <YouTubeSearchTypeFilters
        onTypeChange={() => {
          throw new Error("type failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^videos$/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchTypeFilters] Type change failed",
      { searchType: "videos" },
      expect.any(Error),
    );
    error.mockRestore();
    info.mockRestore();
  });

  it("marks the selected TYPE option as pressed", async () => {
    const { YouTubeSearchTypeFilters } = await loadTypeFilters();
    render(<YouTubeSearchTypeFilters selectedType="channel" />);

    expect(screen.getByRole("button", { name: /^channels$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^videos$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
