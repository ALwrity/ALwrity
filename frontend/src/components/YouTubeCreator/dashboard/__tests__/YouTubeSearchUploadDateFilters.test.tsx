/**
 * TDD: Search filters UPLOAD DATE column.
 *
 * Search.list has no upload-date enum. Map UI buckets to publishedAfter
 * (RFC 3339). Do not invent Last hour. Do not send publishedBefore.
 *
 * Frozen-clock calendar UTC (implementation must use _youtube_search_utc_now):
 *   Today      → start of current UTC day
 *   This week  → Monday 00:00:00Z of the current ISO week
 *   This month → first day of the current UTC month
 *   This year  → 1 January 00:00:00Z of the current UTC year
 *
 * Frontend sends upload_date: today | week | month | year.
 * Duration 4-minute buckets, TYPE, and chips stay as they are.
 *
 * Out of scope: Prioritise, Unwatched/Watched, Last hour. FEATURES is a separate column.
 * Do not restyle Disconnect, Channel Pulse, or wedges.
 *
 * Product Upload Date UI/Hub wiring is not implemented yet — those tests
 * fail until the next implementation command.
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

describe("YouTube search Upload Date column in Search filters", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  it("opens Search filters with UPLOAD DATE Today, This week, This month, This year", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^upload date$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^today$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^this week$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^this month$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^this year$/i })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /last hour/i })).toBeNull();
  });

  it("keeps TYPE and Duration beside Upload Date, includes FEATURES, and does not add Prioritise", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^type$/i })).toBeTruthy();
    expect(within(dialog).getByRole("group", { name: /^duration$/i })).toBeTruthy();
    expect(within(dialog).getByRole("group", { name: /^upload date$/i })).toBeTruthy();
    expect(within(dialog).getByRole("group", { name: /^features$/i })).toBeTruthy();
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

  it("notifies onUploadDateChange from UPLOAD DATE options in Search filters", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onUploadDateChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onUploadDateChange={onUploadDateChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^today$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^this week$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^this month$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^this year$/i },
      ),
    );

    expect(onUploadDateChange).toHaveBeenCalledWith("today");
    expect(onUploadDateChange).toHaveBeenCalledWith("week");
    expect(onUploadDateChange).toHaveBeenCalledWith("month");
    expect(onUploadDateChange).toHaveBeenCalledWith("year");
  });

  it("closes Search filters after an Upload Date option is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onUploadDateChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("dialog", { name: /search filters/i })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^this week$/i },
      ),
    );
    expect(
      screen.queryByRole("dialog", { name: /search filters/i }),
    ).toBeNull();
  });

  it("marks the selected Upload Date option as pressed and others not", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        selectedUploadDate="month"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(
      within(dialog).getByRole("button", { name: /^this month$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: /^today$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dialog).getByRole("button", { name: /^this week$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(dialog).getByRole("button", { name: /^this year$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows No videos found without fake videos for an empty Upload Date result", async () => {
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

describe("YouTubeSearchUploadDateFilters", () => {
  async function loadUploadDateFilters() {
    const modulePath = "../YouTubeSearchUploadDateFilters";
    return import(/* @vite-ignore */ modulePath);
  }

  it("shows the UPLOAD DATE group with Today, This week, This month, This year", async () => {
    const { YouTubeSearchUploadDateFilters } = await loadUploadDateFilters();
    render(<YouTubeSearchUploadDateFilters />);

    expect(screen.getByRole("group", { name: /^upload date$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^today$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^this week$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^this month$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^this year$/i })).toBeTruthy();
  });

  it("does not show later Search filters columns or history chips", async () => {
    const { YouTubeSearchUploadDateFilters } = await loadUploadDateFilters();
    render(<YouTubeSearchUploadDateFilters />);

    expect(screen.queryByRole("group", { name: /^type$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^duration$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^features$/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /^prioritise$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /unwatched/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^watched$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /last hour/i })).toBeNull();
  });

  it("notifies onUploadDateChange with upload_date ids", async () => {
    const { YouTubeSearchUploadDateFilters } = await loadUploadDateFilters();
    const onUploadDateChange = vi.fn();
    render(
      <YouTubeSearchUploadDateFilters onUploadDateChange={onUploadDateChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^today$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^this week$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^this month$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^this year$/i }));

    expect(onUploadDateChange).toHaveBeenCalledWith("today");
    expect(onUploadDateChange).toHaveBeenCalledWith("week");
    expect(onUploadDateChange).toHaveBeenCalledWith("month");
    expect(onUploadDateChange).toHaveBeenCalledWith("year");
  });

  it("marks only the selected Upload Date option as pressed", async () => {
    const { YouTubeSearchUploadDateFilters } = await loadUploadDateFilters();
    render(<YouTubeSearchUploadDateFilters selectedUploadDate="year" />);

    expect(
      screen.getByRole("button", { name: /^this year$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /^today$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /^this week$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /^this month$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("logs Upload Date change errors without crashing", async () => {
    const { YouTubeSearchUploadDateFilters } = await loadUploadDateFilters();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(
      <YouTubeSearchUploadDateFilters
        onUploadDateChange={() => {
          throw new Error("upload date failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^this month$/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchUploadDateFilters] Upload date change failed",
      { uploadDate: "month" },
      expect.any(Error),
    );
    error.mockRestore();
    info.mockRestore();
  });
});

describe("Hub Upload Date wiring", () => {
  it("Hub wires Upload Date through youtubeHubSearchRequests", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("searchYouTubeByUploadDate");
    expect(hub).toContain("onUploadDateChange");
    expect(hub).toContain("YouTubeHubConnectButton");
  });

  it("resets Upload Date when a new header search opens the panel", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("setSearchUploadDate(undefined)");
  });

  it("panel mounts YouTubeSearchUploadDateFilters in Search filters", () => {
    const panel = fs.readFileSync(PANEL_SOURCE, "utf8");
    expect(panel).toContain("YouTubeSearchUploadDateFilters");
    expect(panel).toContain("onUploadDateChange");
  });

  it("Upload Date requests do not apply Shorts hashtag keep", () => {
    const requests = fs.readFileSync(HUB_SEARCH_REQUESTS, "utf8");
    const uploadFn = requests.slice(
      requests.indexOf("export async function searchYouTubeByUploadDate"),
    );
    expect(requests).toContain("export async function searchYouTubeByUploadDate");
    expect(uploadFn).toContain("upload_date: uploadDate");
    expect(uploadFn).not.toContain("isYouTubeShortsTitle");
    expect(uploadFn).not.toContain("No Shorts found.");
  });
});
