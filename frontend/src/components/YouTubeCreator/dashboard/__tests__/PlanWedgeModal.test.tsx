import React from "react";
import { render, screen } from "@testing-library/react";
import { PlanWedgeModal } from "../modals/PlanWedgeModal";

describe("PlanWedgeModal", () => {
  const baseProps = {
    open: true,
    onClose: jest.fn(),
    goCreate: jest.fn(),
    markNotify: jest.fn(),
    notifyKeys: {},
    channelBibleNiche: null,
    onOpenBible: jest.fn(),
  };

  it("renders all six Plan tiles enabled when testing unlock is on", () => {
    render(<PlanWedgeModal {...baseProps} />);

    const tiles = [
      "Topic Discovery",
      "Channel Bible",
      "Blog / URL → Video",
      "YouTube Trends",
      "Series Planner",
      "Brainstorm & Saved Ideas",
    ];

    tiles.forEach((title) => {
      const button = screen.getByRole("button", { name: new RegExp(title, "i") });
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    expect(screen.queryByText("Coming soon")).toBeNull();
  });
});
