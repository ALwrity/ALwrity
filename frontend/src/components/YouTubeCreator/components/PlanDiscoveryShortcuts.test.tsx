import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanDiscoveryShortcuts } from "./PlanDiscoveryShortcuts";

const mockOpenYouTubePlanFromCreator = vi.fn();

vi.mock("../dashboard/youtubeStudioEvents", () => ({
  openYouTubePlanFromCreator: (...args: unknown[]) => mockOpenYouTubePlanFromCreator(...args),
}));

describe("PlanDiscoveryShortcuts", () => {
  beforeEach(() => {
    mockOpenYouTubePlanFromCreator.mockClear();
  });

  it("opens Plan brainstorm with seed from idea field", () => {
    render(<PlanDiscoveryShortcuts userIdea="  Quantum computing  " />);

    fireEvent.click(screen.getByRole("button", { name: /Brainstorm Video Idea/i }));

    expect(mockOpenYouTubePlanFromCreator).toHaveBeenCalledWith({
      sub: "brainstorm",
      seed: "Quantum computing",
    });
  });

  it("opens Plan Blog/URL import", () => {
    render(<PlanDiscoveryShortcuts userIdea="" />);

    fireEvent.click(screen.getByRole("button", { name: /Blog \/ URL → Video/i }));

    expect(mockOpenYouTubePlanFromCreator).toHaveBeenCalledWith({
      sub: "url-import",
      seed: undefined,
    });
  });

  it("disables buttons when loading", () => {
    render(<PlanDiscoveryShortcuts userIdea="Test" disabled />);

    expect(screen.getByRole("button", { name: /Brainstorm Video Idea/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Blog \/ URL → Video/i })).toBeDisabled();
  });
});
