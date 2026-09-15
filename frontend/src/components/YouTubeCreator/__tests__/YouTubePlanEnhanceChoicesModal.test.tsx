/**
 * Hub-themed 3-choice modal for enhanced Plan topics.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanEnhanceChoicesModal } from "../components/YouTubePlanEnhanceChoicesModal";

describe("YouTubePlanEnhanceChoicesModal", () => {
  it("lets the user pick an edited choice", () => {
    const onSelectChoice = vi.fn();
    render(
      <YouTubePlanEnhanceChoicesModal
        open
        enhancedIdeas={["One", "Two", "Three"]}
        rationales={["A", "B", "C"]}
        onClose={vi.fn()}
        onSelectChoice={onSelectChoice}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Two"), {
      target: { value: "Two edited" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /use this topic/i })[1]);
    expect(onSelectChoice).toHaveBeenCalledWith("Two edited");
  });

  it("does not use Podcast purple chrome", () => {
    const { container } = render(
      <YouTubePlanEnhanceChoicesModal
        open
        enhancedIdeas={["One", "Two", "Three"]}
        rationales={["A", "B", "C"]}
        onClose={vi.fn()}
        onSelectChoice={vi.fn()}
      />,
    );
    expect(container.innerHTML).not.toMatch(/667eea|#9c27b0|podcast/i);
  });
});
