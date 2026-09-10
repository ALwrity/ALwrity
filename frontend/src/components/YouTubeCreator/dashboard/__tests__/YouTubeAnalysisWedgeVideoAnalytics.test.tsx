/**
 * Analysis wedge — Video Analytics opens Studio chrome, not Video Performance.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnalysisWedgeModal } from "../modals/AnalysisWedgeModal";

function renderAnalysis(overrides: {
  onOpenVideoAnalytics?: () => void;
  onOpenVideoPerformance?: () => void;
  onOpenPulse?: () => void;
} = {}) {
  const onOpenVideoAnalytics = overrides.onOpenVideoAnalytics ?? vi.fn();
  const onOpenVideoPerformance = overrides.onOpenVideoPerformance ?? vi.fn();
  const onOpenPulse = overrides.onOpenPulse ?? vi.fn();
  const onOpenSeo = vi.fn();
  const onOpenGaps = vi.fn();
  const onOpenRetention = vi.fn();
  render(
    <AnalysisWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected
      onRequestConnect={vi.fn()}
      onOpenPulse={onOpenPulse}
      onOpenVideoPerformance={onOpenVideoPerformance}
      onOpenVideoAnalytics={onOpenVideoAnalytics}
      onOpenSeo={onOpenSeo}
      onOpenGaps={onOpenGaps}
      onOpenRetention={onOpenRetention}
    />,
  );
  return {
    onOpenVideoAnalytics,
    onOpenVideoPerformance,
    onOpenPulse,
    onOpenSeo,
    onOpenGaps,
    onOpenRetention,
  };
}

describe("AnalysisWedgeModal Video Analytics tile", () => {
  it("opens Video Analytics without touching Video Performance or Pulse", () => {
    const handlers = renderAnalysis();

    fireEvent.click(screen.getByRole("button", { name: /Video Analytics/i }));

    expect(handlers.onOpenVideoAnalytics).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenVideoPerformance).not.toHaveBeenCalled();
    expect(handlers.onOpenPulse).not.toHaveBeenCalled();
    expect(handlers.onOpenSeo).not.toHaveBeenCalled();
    expect(handlers.onOpenGaps).not.toHaveBeenCalled();
    expect(handlers.onOpenRetention).not.toHaveBeenCalled();
  });

  it("describes the four Studio analytics tabs", () => {
    renderAnalysis();
    expect(
      screen.getByText("Overview, Audience, Content, and Trends for your videos."),
    ).toBeTruthy();
  });
});
