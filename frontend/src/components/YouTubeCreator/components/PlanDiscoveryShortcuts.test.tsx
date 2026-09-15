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

  it("exposes Hub chip tooltips on Brainstorm and Blog/URL", () => {
    render(<PlanDiscoveryShortcuts userIdea="Test" />);
    expect(screen.getByRole("button", { name: /Brainstorm Video Idea/i })).toHaveAttribute(
      "data-tooltip",
      "Not sure what to film? Brainstorm ideas from your topic and Channel Bible.",
    );
    expect(screen.getByRole("button", { name: /Blog \/ URL → Video/i })).toHaveAttribute(
      "data-tooltip",
      "Have a blog or article? Paste the URL and we will turn it into a video idea.",
    );
    expect(screen.getByRole("button", { name: /Brainstorm Video Idea/i }).className).toMatch(
      /yt-plan-hub-action/,
    );
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
