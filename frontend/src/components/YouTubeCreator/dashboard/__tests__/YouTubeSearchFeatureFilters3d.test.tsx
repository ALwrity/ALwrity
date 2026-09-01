/**
 * TDD slice 2: FEATURES 3D only.
 *
 * Search.list videoDimension=3d (requires type=video).
 * Do not map 360° or VR180 to 3D.
 *
 * Run after slice 1 (Live, HD, Subtitles/CC, Creative Commons) is green.
 * Do not restyle Disconnect, Channel Pulse, or wedges.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

const SAMPLE_HIT = {
  video_id: "vid123",
  title: "How to train dogs",
};

describe("YouTube search FEATURES 3D (slice 2)", () => {
  async function loadPanel() {
    return import("../YouTubeSearchResultsPanel");
  }

  async function loadFeatureFilters() {
    return import("../YouTubeSearchFeatureFilters");
  }

  it("shows 3D in FEATURES after Live, HD, Subtitles/CC, Creative Commons", async () => {
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
    expect(within(dialog).getByRole("button", { name: /^3d$/i })).toBeTruthy();
  });

  it("still does not ship 4K, 360°, VR180, HDR, Location, or Purchased", async () => {
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

  it("notifies onFeatureChange with 3d", async () => {
    const { YouTubeSearchFeatureFilters } = await loadFeatureFilters();
    const onFeatureChange = vi.fn();
    render(<YouTubeSearchFeatureFilters onFeatureChange={onFeatureChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^3d$/i }));
    expect(onFeatureChange).toHaveBeenCalledWith("3d");
  });
});
