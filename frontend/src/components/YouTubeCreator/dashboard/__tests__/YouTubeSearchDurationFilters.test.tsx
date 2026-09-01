/**
 * TDD: Search filters DURATION column.
 *
 * Search.list videoDuration (requires type=video):
 *   Under 4 minutes → short  (< 4 minutes)
 *   4–20 minutes    → medium (4–20 minutes inclusive)
 *   Over 20 minutes → long   (> 20 minutes)
 *
 * Google has no 3-minute Search.list cutoff. Do not invent one.
 * Duration short is NOT the Shorts chip/TYPE: no #shorts hashtag keep.
 *
 * Out of scope: Upload date, Features, Prioritise, Unwatched/Watched.
 * Do not restyle Disconnect, Channel Pulse, or wedges.
 * Do not change chip-row behavior.
 *
 * Product Duration UI/Hub wiring is not implemented yet — those tests fail
 * until the next implementation command. Router/API forwarding of
 * video_duration already exists from keyword search.
 */
import * as fs from "fs";
import * as path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";

const SAMPLE_HIT = {
  video_id: "vid123",
  title: "How to train dogs",
};

const HUB_SOURCE = path.join(__dirname, "../YouTubeStudioHub.tsx");
const HUB_SEARCH_REQUESTS = path.join(
  __dirname,
  "../youtubeHubSearchRequests.ts",
);
const PANEL_SOURCE = path.join(__dirname, "../YouTubeSearchResultsPanel.tsx");

describe("YouTube search Duration column in Search filters", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  it("opens Search filters with DURATION Under 4 minutes, 4–20 minutes, Over 20 minutes", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^duration$/i })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /^under 4 minutes$/i }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /^4–20 minutes$/i }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /^over 20 minutes$/i }),
    ).toBeTruthy();
  });

  it("keeps TYPE beside Duration and does not add later columns", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^type$/i })).toBeTruthy();
    expect(within(dialog).getByRole("group", { name: /^duration$/i })).toBeTruthy();
    expect(within(dialog).queryByRole("group", { name: /^upload date$/i })).toBeNull();
    expect(within(dialog).queryByRole("group", { name: /^features$/i })).toBeNull();
    expect(within(dialog).queryByRole("group", { name: /^prioritise$/i })).toBeNull();
  });

  it("keeps All, Videos, Shorts, Recently uploaded, Live chips", async () => {
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

  it("notifies onDurationChange from DURATION options in Search filters", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onDurationChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onDurationChange={onDurationChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^under 4 minutes$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^4–20 minutes$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^over 20 minutes$/i },
      ),
    );

    expect(onDurationChange).toHaveBeenCalledWith("short");
    expect(onDurationChange).toHaveBeenCalledWith("medium");
    expect(onDurationChange).toHaveBeenCalledWith("long");
  });

  it("closes Search filters after a Duration option is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onDurationChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("dialog", { name: /search filters/i })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^over 20 minutes$/i },
      ),
    );
    expect(
      screen.queryByRole("dialog", { name: /search filters/i }),
    ).toBeNull();
  });

  it("marks the selected Duration option as pressed and others not", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        selectedDuration="medium"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(
      within(dialog).getByRole("button", { name: /^4–20 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: /^under 4 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dialog).getByRole("button", { name: /^over 20 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows No videos found without fake videos for an empty Duration result", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[]}
        message="No videos found."
      />,
    );

    expect(screen.getByText("No videos found.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("YouTubeSearchDurationFilters", () => {
  async function loadDurationFilters() {
    const modulePath = "../YouTubeSearchDurationFilters";
    return import(/* @vite-ignore */ modulePath);
  }

  it("shows the DURATION group with Under 4 minutes, 4–20 minutes, Over 20 minutes", async () => {
    const { YouTubeSearchDurationFilters } = await loadDurationFilters();
    render(<YouTubeSearchDurationFilters />);

    expect(screen.getByRole("group", { name: /^duration$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^under 4 minutes$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^4–20 minutes$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^over 20 minutes$/i })).toBeTruthy();
  });

  it("does not show later Search filters columns or history chips", async () => {
    const { YouTubeSearchDurationFilters } = await loadDurationFilters();
    render(<YouTubeSearchDurationFilters />);

    expect(screen.queryByRole("group", { name: /^type$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^upload date$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^features$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^prioritise$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /unwatched/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^watched$/i })).toBeNull();
  });

  it("notifies onDurationChange with Search.list videoDuration ids", async () => {
    const { YouTubeSearchDurationFilters } = await loadDurationFilters();
    const onDurationChange = vi.fn();
    render(<YouTubeSearchDurationFilters onDurationChange={onDurationChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^under 4 minutes$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^4–20 minutes$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^over 20 minutes$/i }));

    expect(onDurationChange).toHaveBeenCalledWith("short");
    expect(onDurationChange).toHaveBeenCalledWith("medium");
    expect(onDurationChange).toHaveBeenCalledWith("long");
  });

  it("marks only the selected Duration option as pressed", async () => {
    const { YouTubeSearchDurationFilters } = await loadDurationFilters();
    render(<YouTubeSearchDurationFilters selectedDuration="long" />);

    expect(
      screen.getByRole("button", { name: /^over 20 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /^under 4 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /^4–20 minutes$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("logs Duration change errors without crashing", async () => {
    const { YouTubeSearchDurationFilters } = await loadDurationFilters();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(
      <YouTubeSearchDurationFilters
        onDurationChange={() => {
          throw new Error("duration failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^4–20 minutes$/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchDurationFilters] Duration change failed",
      { videoDuration: "medium" },
      expect.any(Error),
    );
    error.mockRestore();
    info.mockRestore();
  });
});

describe("Hub Duration wiring", () => {
  it("Hub wires Duration through youtubeHubSearchRequests", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("searchYouTubeByDuration");
    expect(hub).toContain("onDurationChange");
    expect(hub).toContain("YouTubeHubConnectButton");
  });

  it("resets Duration when a new header search opens the panel", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("setSearchDuration(undefined)");
  });

  it("panel mounts YouTubeSearchDurationFilters in Search filters", () => {
    const panel = fs.readFileSync(PANEL_SOURCE, "utf8");
    expect(panel).toContain("YouTubeSearchDurationFilters");
    expect(panel).toContain("onDurationChange");
  });

  it("Duration requests do not apply Shorts hashtag keep", () => {
    const requests = fs.readFileSync(HUB_SEARCH_REQUESTS, "utf8");
    const durationFn = requests.slice(
      requests.indexOf("export async function searchYouTubeByDuration"),
    );
    expect(requests).toContain("export async function searchYouTubeByDuration");
    expect(durationFn).toContain('video_duration: duration');
    expect(durationFn).not.toContain("isYouTubeShortsTitle");
    expect(durationFn).not.toContain("No Shorts found.");
  });
});
