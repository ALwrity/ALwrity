/**
 * Existing Engagement wedge — Comment Reply Assistant tile opens comments.
 * Hub chrome and Podcast Maker are out of scope.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EngagementWedgeModal } from "../modals/EngagementWedgeModal";

function renderEngagement(overrides: {
  connected?: boolean;
  onOpenComments?: () => void;
  onRequestConnect?: () => void;
} = {}) {
  const onOpenComments = overrides.onOpenComments ?? vi.fn();
  const onRequestConnect = overrides.onRequestConnect ?? vi.fn();
  render(
    <EngagementWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected={overrides.connected ?? true}
      onRequestConnect={onRequestConnect}
      onOpenComments={onOpenComments}
    />,
  );
  return { onOpenComments, onRequestConnect };
}

describe("EngagementWedgeModal Comment Reply Assistant", () => {
  it("opens Comment Reply Assistant when YouTube is connected", () => {
    const { onOpenComments, onRequestConnect } = renderEngagement({ connected: true });

    fireEvent.click(screen.getByRole("button", { name: /Comment Reply Assistant/i }));

    expect(onOpenComments).toHaveBeenCalledTimes(1);
    expect(onRequestConnect).not.toHaveBeenCalled();
  });

  it("still opens comments when disconnected because tile OAuth gate is off", () => {
    const { onOpenComments, onRequestConnect } = renderEngagement({ connected: false });

    fireEvent.click(screen.getByRole("button", { name: /Comment Reply Assistant/i }));

    expect(onOpenComments).toHaveBeenCalledTimes(1);
    expect(onRequestConnect).not.toHaveBeenCalled();
  });
});
