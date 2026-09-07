/**
 * Analysis wedge — Video Performance opens analytics, not Remarket Stale Refresh.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnalysisWedgeModal } from "../modals/AnalysisWedgeModal";

function renderAnalysis(overrides: {
  connected?: boolean;
  onOpenVideoPerformance?: () => void;
  onOpenPulse?: () => void;
  onOpenSeo?: () => void;
  onOpenGaps?: () => void;
  onOpenRetention?: () => void;
  onRequestConnect?: () => void;
} = {}) {
  const onOpenVideoPerformance = overrides.onOpenVideoPerformance ?? vi.fn();
  const onOpenPulse = overrides.onOpenPulse ?? vi.fn();
  const onOpenSeo = overrides.onOpenSeo ?? vi.fn();
  const onOpenGaps = overrides.onOpenGaps ?? vi.fn();
  const onOpenRetention = overrides.onOpenRetention ?? vi.fn();
  const onRequestConnect = overrides.onRequestConnect ?? vi.fn();
  render(
    <AnalysisWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected={overrides.connected ?? true}
      onRequestConnect={onRequestConnect}
      onOpenPulse={onOpenPulse}
      onOpenVideoPerformance={onOpenVideoPerformance}
      onOpenSeo={onOpenSeo}
      onOpenGaps={onOpenGaps}
      onOpenRetention={onOpenRetention}
    />,
  );
  return {
    onOpenVideoPerformance,
    onOpenPulse,
    onOpenSeo,
    onOpenGaps,
    onOpenRetention,
    onRequestConnect,
  };
}

describe("AnalysisWedgeModal Video Performance tile", () => {
  it("opens Video Performance analytics when YouTube is connected", () => {
    const { onOpenVideoPerformance, onRequestConnect, onOpenPulse } = renderAnalysis({
      connected: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /Video Performance/i }));

    expect(onOpenVideoPerformance).toHaveBeenCalledTimes(1);
    expect(onOpenPulse).not.toHaveBeenCalled();
    expect(onRequestConnect).not.toHaveBeenCalled();
  });

  it("still opens Video Performance when disconnected because tile OAuth gate is off", () => {
    const { onOpenVideoPerformance, onRequestConnect } = renderAnalysis({
      connected: false,
    });

    fireEvent.click(screen.getByRole("button", { name: /Video Performance/i }));

    expect(onOpenVideoPerformance).toHaveBeenCalledTimes(1);
    expect(onRequestConnect).not.toHaveBeenCalled();
  });

  it("does not open Pulse, SEO, Gaps, or Retention from Video Performance", () => {
    const handlers = renderAnalysis({ connected: true });

    fireEvent.click(screen.getByRole("button", { name: /Video Performance/i }));

    expect(handlers.onOpenVideoPerformance).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenPulse).not.toHaveBeenCalled();
    expect(handlers.onOpenSeo).not.toHaveBeenCalled();
    expect(handlers.onOpenGaps).not.toHaveBeenCalled();
    expect(handlers.onOpenRetention).not.toHaveBeenCalled();
  });

  it("describes recent uploads with view and like signals", () => {
    renderAnalysis();
    expect(
      screen.getByText("Recent uploads with view/like signals from your channel."),
    ).toBeTruthy();
  });
});
