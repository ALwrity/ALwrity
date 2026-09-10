/**
 * Engagement wedge catalog — Comment Reply Assistant only.
 * Engage Queue duplicated comments; Pin pack and Community Posts do not belong here.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { EngagementWedgeModal } from "../modals/EngagementWedgeModal";
import { YOUTUBE_WORKFLOW_CARDS } from "../youtubeWorkflowConfig";

function renderEngagement() {
  render(
    <EngagementWedgeModal
      open
      onClose={vi.fn()}
      goCreate={vi.fn()}
      connected
      onRequestConnect={vi.fn()}
      onOpenComments={vi.fn()}
    />,
  );
}

describe("EngagementWedgeModal tile catalog", () => {
  it("keeps Comment Reply Assistant", () => {
    renderEngagement();
    expect(screen.getByRole("dialog", { name: "Engagement" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Comment Reply Assistant/i }),
    ).toBeTruthy();
  });

  it("does not list Engage Queue or Pin / Top Comment Pack", () => {
    renderEngagement();
    expect(screen.queryByRole("button", { name: /Engage Queue/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Pin \/ Top Comment Pack/i }),
    ).toBeNull();
  });

  it("does not list Community Post Ideas (that tile lives on Plan)", () => {
    renderEngagement();
    expect(
      screen.queryByRole("button", { name: /Community Post Ideas/i }),
    ).toBeNull();
  });

  it("describes the Engagement hub wedge as replies, not pin or community", () => {
    const card = YOUTUBE_WORKFLOW_CARDS.find((row) => row.id === "engagement");
    expect(card?.description).toBe(
      "15-minute authority routine — draft replies, you send",
    );
    expect(card?.description).not.toMatch(/pin/i);
    expect(card?.description).not.toMatch(/community/i);
  });
});
