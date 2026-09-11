/**
 * Remarket wedge — Content Gaps moves here from Analysis. HITL open stays the same.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RemarketWedgeModal } from "../modals/RemarketWedgeModal";
import type { YouTubeCreatorState } from "../../../../hooks/useYouTubeCreatorState";

const emptyCreatorState = {
  userIdea: "",
  videoPlan: null,
  scenes: [],
} as unknown as YouTubeCreatorState;

function renderRemarket(overrides: {
  connected?: boolean;
  onOpenGaps?: () => void;
  onOpenStale?: () => void;
  onRequestConnect?: () => void;
} = {}) {
  const onOpenGaps = overrides.onOpenGaps ?? vi.fn();
  const onOpenStale = overrides.onOpenStale ?? vi.fn();
  const onRequestConnect = overrides.onRequestConnect ?? vi.fn();
  render(
    <RemarketWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected={overrides.connected ?? true}
      onRequestConnect={onRequestConnect}
      creatorState={emptyCreatorState}
      onOpenStale={onOpenStale}
      onNavigateBlog={vi.fn()}
      onNavigateLibrary={vi.fn()}
      onOpenGaps={onOpenGaps}
    />,
  );
  return { onOpenGaps, onOpenStale, onRequestConnect };
}

describe("RemarketWedgeModal Content Gaps tile", () => {
  it("lists Content Gaps with the Channel Bible description and HITL", () => {
    renderRemarket();
    expect(screen.getByRole("dialog", { name: "Remarket" })).toBeTruthy();
    const tile = screen.getByRole("button", { name: /Content Gaps/i });
    expect(tile).toBeTruthy();
    expect(tile).toHaveTextContent(
      "Fill niche holes from your Channel Bible + recent uploads.",
    );
    expect(tile).toHaveTextContent("HITL");
    expect(screen.getByRole("button", { name: /Stale Video Refresh/i })).toBeTruthy();
  });

  it("opens Content Gaps without touching Stale Refresh or OAuth connect", () => {
    const handlers = renderRemarket({ connected: true });
    fireEvent.click(screen.getByRole("button", { name: /Content Gaps/i }));
    expect(handlers.onOpenGaps).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenStale).not.toHaveBeenCalled();
    expect(handlers.onRequestConnect).not.toHaveBeenCalled();
  });

  it("still opens Content Gaps when disconnected because the tile is not OAuth-gated", () => {
    const handlers = renderRemarket({ connected: false });
    fireEvent.click(screen.getByRole("button", { name: /Content Gaps/i }));
    expect(handlers.onOpenGaps).toHaveBeenCalledTimes(1);
    expect(handlers.onRequestConnect).not.toHaveBeenCalled();
  });

  it("logs Content Gaps open for production debugging", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    renderRemarket();
    fireEvent.click(screen.getByRole("button", { name: /Content Gaps/i }));
    expect(info).toHaveBeenCalledWith("[YouTubeRemarket] Open Content Gaps");
    info.mockRestore();
  });
});
