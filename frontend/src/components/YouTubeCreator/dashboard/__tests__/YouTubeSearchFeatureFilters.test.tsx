/**
 * TDD slice 1: Search filters FEATURES column (Search.list-backed only).
 *
 * UI ids → Search.list (requires type=video):
 *   Live              → eventType=live
 *   HD                → videoDefinition=high
 *   Subtitles/CC      → videoCaption=closedCaption
 *   Creative Commons  → videoLicense=creativeCommon
 *
 * Frontend sends video_feature: live | hd | subtitles | creative_commons
 * 3D (video_feature=3d) is covered in YouTubeSearchFeatureFilters3d.test.tsx.
 *
 * Do not invent Search.list params for 4K, 360°, VR180, HDR, Location,
 * or Purchased (same rule as Last hour).
 *
 * Keep TYPE, Duration, Upload Date, and chips. Prioritise is later.
 * Do not restyle Disconnect, Channel Pulse, or wedges.
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

describe("YouTube search FEATURES column in Search filters (slice 1)", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  it("opens Search filters with FEATURES Live, HD, Subtitles/CC, Creative Commons", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).getByRole("group", { name: /^features$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^live$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^hd$/i })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /^subtitles\/cc$/i }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /^creative commons$/i }),
    ).toBeTruthy();
  });

  it("does not ship Search.list-unsupported FEATURES options", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));

    const dialog = screen.getByRole("dialog", { name: /search filters/i });
    expect(within(dialog).queryByRole("button", { name: /^4k$/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /360/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^vr180$/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^hdr$/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^location$/i })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /^purchased$/i })).toBeNull();
  });

  it("keeps TYPE, Duration, and Upload Date beside FEATURES and not Prioritise", async () => {
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

  it("notifies onFeatureChange from FEATURES options in Search filters", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    const onFeatureChange = vi.fn();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFeatureChange={onFeatureChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^live$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^hd$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^subtitles\/cc$/i },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^creative commons$/i },
      ),
    );

    expect(onFeatureChange).toHaveBeenCalledWith("live");
    expect(onFeatureChange).toHaveBeenCalledWith("hd");
    expect(onFeatureChange).toHaveBeenCalledWith("subtitles");
    expect(onFeatureChange).toHaveBeenCalledWith("creative_commons");
  });

  it("closes Search filters after a FEATURES option is selected", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(
      <YouTubeSearchResultsPanel
        isOpen
        items={[SAMPLE_HIT]}
        onFeatureChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    expect(screen.getByRole("dialog", { name: /search filters/i })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /search filters/i })).getByRole(
        "button",
        { name: /^hd$/i },
      ),
    );
    expect(screen.queryByRole("dialog", { name: /search filters/i })).toBeNull();
  });

  it("closes Search filters from the dialog close control", async () => {
    const { YouTubeSearchResultsPanel } = await loadPanel();
    render(<YouTubeSearchResultsPanel isOpen items={[SAMPLE_HIT]} />);

    fireEvent.click(screen.getByRole("button", { name: /^filters$/i }));
    fireEvent.click(screen.getByRole("button", { name: /close search filters/i }));
    expect(screen.queryByRole("dialog", { name: /search filters/i })).toBeNull();
  });
});

describe("YouTubeSearchFeatureFilters", () => {
  async function loadFeatureFilters() {
    return import("../YouTubeSearchFeatureFilters");
  }

  it("notifies onFeatureChange with video_feature ids", async () => {
    const { YouTubeSearchFeatureFilters } = await loadFeatureFilters();
    const onFeatureChange = vi.fn();
    render(<YouTubeSearchFeatureFilters onFeatureChange={onFeatureChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^live$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^hd$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^subtitles\/cc$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^creative commons$/i }));

    expect(onFeatureChange).toHaveBeenCalledWith("live");
    expect(onFeatureChange).toHaveBeenCalledWith("hd");
    expect(onFeatureChange).toHaveBeenCalledWith("subtitles");
    expect(onFeatureChange).toHaveBeenCalledWith("creative_commons");
  });

  it("clicking the selected FEATURES option still notifies so it can be cleared", async () => {
    const { YouTubeSearchFeatureFilters } = await loadFeatureFilters();
    const onFeatureChange = vi.fn();
    render(
      <YouTubeSearchFeatureFilters
        selectedFeature="hd"
        onFeatureChange={onFeatureChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^hd$/i }));
    expect(onFeatureChange).toHaveBeenCalledWith("hd");
  });

  it("marks the selected FEATURES option as pressed and others not", async () => {
    const { YouTubeSearchFeatureFilters } = await loadFeatureFilters();
    render(<YouTubeSearchFeatureFilters selectedFeature="hd" />);

    expect(screen.getByRole("button", { name: /^hd$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^live$/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("button", { name: /^subtitles\/cc$/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /^creative commons$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("logs FEATURES change errors without crashing", async () => {
    const { YouTubeSearchFeatureFilters } = await loadFeatureFilters();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    render(
      <YouTubeSearchFeatureFilters
        onFeatureChange={() => {
          throw new Error("feature failed");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^hd$/i }));
    expect(error).toHaveBeenCalledWith(
      "[YouTubeSearchFeatureFilters] Feature change failed",
      { videoFeature: "hd" },
      expect.any(Error),
    );
    error.mockRestore();
    info.mockRestore();
  });
});

describe("Hub FEATURES wiring", () => {
  it("Hub wires FEATURES through youtubeHubSearchRequests", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("searchYouTubeByFeature");
    expect(hub).toContain("onFeatureChange");
    expect(hub).toContain("YouTubeHubConnectButton");
  });

  it("resets FEATURES when a new header search opens the panel", () => {
    const hub = fs.readFileSync(HUB_SOURCE, "utf8");
    expect(hub).toContain("setSearchFeature(undefined)");
  });

  it("panel mounts YouTubeSearchFeatureFilters in Search filters", () => {
    const panel = fs.readFileSync(PANEL_SOURCE, "utf8");
    expect(panel).toContain("YouTubeSearchFeatureFilters");
    expect(panel).toContain("onFeatureChange");
  });

  it("FEATURES requests do not apply Shorts hashtag keep", () => {
    const requests = fs.readFileSync(HUB_SEARCH_REQUESTS, "utf8");
    const start = requests.indexOf("export async function searchYouTubeByFeature");
    const fromFn = requests.slice(start);
    const nextExport = fromFn.indexOf("\nexport async function ");
    const featureFn = nextExport === -1 ? fromFn : fromFn.slice(0, nextExport);
    expect(requests).toContain("export async function searchYouTubeByFeature");
    expect(featureFn).toContain("video_feature: feature");
    expect(featureFn).not.toContain("isYouTubeShortsTitle");
    expect(featureFn).not.toContain("No Shorts found.");
  });
});
