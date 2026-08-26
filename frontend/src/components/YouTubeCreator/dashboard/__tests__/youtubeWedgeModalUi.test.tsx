import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  youtubeSubModalShellProps,
  youtubeWedgeShellProps,
} from "../youtubeWedgeModalUi";

describe("youtubeWedgeModalUi", () => {
  it("builds Hub shell with Studio Hub back label", () => {
    const onClose = vi.fn();
    const shell = youtubeWedgeShellProps(onClose);
    expect(shell.maxWidth).toBe(YOUTUBE_WEDGE_MODAL_MAX_WIDTH);
    expect(shell.backLabel).toBe("Studio Hub");
    shell.onBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("builds sub-modal shell with parent wedge back label", () => {
    const onBack = vi.fn();
    const shell = youtubeSubModalShellProps("analysis", onBack);
    expect(shell.maxWidth).toBe(YOUTUBE_WEDGE_MODAL_MAX_WIDTH);
    expect(shell.backLabel).toBe("Analysis");
    shell.onBack();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
