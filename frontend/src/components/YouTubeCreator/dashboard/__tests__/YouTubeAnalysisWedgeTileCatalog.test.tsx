/**
 * Analysis wedge catalog — keep Pulse / Performance / Analytics.
 * SEO Audit, Audience/Retention, and Content Gaps do not belong here.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { AnalysisWedgeModal } from "../modals/AnalysisWedgeModal";

function renderAnalysis() {
  render(
    <AnalysisWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected
      onRequestConnect={vi.fn()}
      onOpenPulse={vi.fn()}
      onOpenVideoPerformance={vi.fn()}
      onOpenVideoAnalytics={vi.fn()}
    />,
  );
}

describe("AnalysisWedgeModal tile catalog", () => {
  it("keeps Channel Pulse, Video Performance, and Video Analytics", () => {
    renderAnalysis();
    expect(screen.getByRole("dialog", { name: "Analysis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Channel Pulse/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Video Performance/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Video Analytics/i })).toBeTruthy();
  });

  it("does not list SEO & Metadata Audit or Audience / Retention", () => {
    renderAnalysis();
    expect(
      screen.queryByRole("button", { name: /SEO & Metadata Audit/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Audience \/ Retention/i }),
    ).toBeNull();
  });

  it("does not list Content Gaps (that tile lives on Remarket)", () => {
    renderAnalysis();
    expect(screen.queryByRole("button", { name: /Content Gaps/i })).toBeNull();
  });

  it("describes Channel Pulse as lifetime subscribers and views plus 28-day watch time", () => {
    renderAnalysis();
    const tile = screen.getByRole("button", { name: /Channel Pulse/i });
    expect(tile).toHaveTextContent(
      "Lifetime subscribers and views, plus 28-day watch time.",
    );
    expect(tile).not.toHaveTextContent("28-day watch metrics");
  });

  it("describes Video Performance as public views, likes, and comments", () => {
    renderAnalysis();
    const tile = screen.getByRole("button", { name: /Video Performance/i });
    expect(tile).toHaveTextContent(
      "Recent uploads with public views, likes, and comments.",
    );
    expect(tile).not.toHaveTextContent("view/like signals");
  });
});
