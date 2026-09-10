/**
 * Remarket wedge — Stale Video Refresh stays on HITL metadata (not Video Performance).
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

describe("RemarketWedgeModal Stale Video Refresh tile", () => {
  it("opens Stale Refresh HITL when YouTube is connected", () => {
    const onOpenStale = vi.fn();
    const onRequestConnect = vi.fn();
    render(
      <RemarketWedgeModal
        open
        onClose={vi.fn()}
        goCreate={vi.fn()}
        connected
        onRequestConnect={onRequestConnect}
        creatorState={emptyCreatorState}
        onOpenStale={onOpenStale}
        onOpenGaps={vi.fn()}
        onNavigateBlog={vi.fn()}
        onNavigateLibrary={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Stale Video Refresh/i }));

    expect(onOpenStale).toHaveBeenCalledTimes(1);
    expect(onRequestConnect).not.toHaveBeenCalled();
  });

  it("still opens Stale Refresh when disconnected because tile OAuth gate is off", () => {
    const onOpenStale = vi.fn();
    const onRequestConnect = vi.fn();
    render(
      <RemarketWedgeModal
        open
        onClose={vi.fn()}
        goCreate={vi.fn()}
        connected={false}
        onRequestConnect={onRequestConnect}
        creatorState={emptyCreatorState}
        onOpenStale={onOpenStale}
        onOpenGaps={vi.fn()}
        onNavigateBlog={vi.fn()}
        onNavigateLibrary={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Stale Video Refresh/i }));

    expect(onOpenStale).toHaveBeenCalledTimes(1);
    expect(onRequestConnect).not.toHaveBeenCalled();
  });
});
