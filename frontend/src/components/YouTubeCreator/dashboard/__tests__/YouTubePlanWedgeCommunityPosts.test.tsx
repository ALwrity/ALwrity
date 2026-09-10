/**
 * Plan wedge — Community Post Ideas moves here from Engagement. HITL open stays the same.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanSidebarTools } from "../modals/YouTubePlanSidebarTools";

function renderPlanTools(overrides: {
  onOpenCommunity?: () => void;
  goCreate?: () => void;
  onOpenUrlImport?: () => void;
} = {}) {
  const onOpenCommunity = overrides.onOpenCommunity ?? vi.fn();
  const goCreate = overrides.goCreate ?? vi.fn();
  const onOpenUrlImport = overrides.onOpenUrlImport ?? vi.fn();
  render(
    <YouTubePlanSidebarTools
      goCreate={goCreate}
      onOpenUrlImport={onOpenUrlImport}
      onOpenCommunity={onOpenCommunity}
    />,
  );
  return { onOpenCommunity, goCreate, onOpenUrlImport };
}

describe("YouTubePlanSidebarTools Community Post Ideas tile", () => {
  it("lists Community Post Ideas with the Studio copy and HITL", () => {
    renderPlanTools();
    const tile = screen.getByRole("button", { name: /Community Post Ideas/i });
    expect(tile).toHaveTextContent(
      "Between-video touchpoints — copy into YouTube Studio.",
    );
    expect(tile).toHaveTextContent("HITL");
    expect(screen.getByRole("button", { name: /Blog \/ URL → Video/i })).toBeTruthy();
  });

  it("opens Community Posts without touching URL import or goCreate", () => {
    const handlers = renderPlanTools();
    fireEvent.click(screen.getByRole("button", { name: /Community Post Ideas/i }));
    expect(handlers.onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenUrlImport).not.toHaveBeenCalled();
    expect(handlers.goCreate).not.toHaveBeenCalled();
  });

  it("logs Community Post Ideas open for production debugging", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    renderPlanTools();
    fireEvent.click(screen.getByRole("button", { name: /Community Post Ideas/i }));
    expect(info).toHaveBeenCalledWith("[YouTubePlan] Open Community Post Ideas");
    info.mockRestore();
  });
});
