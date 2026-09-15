/**
 * Plan idea canvas is its own numbered card, matching the basic-setup pane.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanIdeaPane } from "../components/YouTubePlanIdeaPane";

vi.mock("../dashboard/youtubeStudioEvents", () => ({
  openYouTubePlanFromCreator: vi.fn(),
}));

describe("YouTubePlanIdeaPane", () => {
  it("wraps the idea field in step 1 card chrome", () => {
    render(
      <YouTubePlanIdeaPane userIdea="Budget travel packing" loading={false} onIdeaChange={vi.fn()} />,
    );

    expect(screen.getByRole("region", { name: "Your idea" })).toHaveClass("yt-plan-pane");
    expect(screen.getByLabelText("Step 1")).toBeTruthy();
    expect(screen.getByText("What's your video about?")).toBeTruthy();
  });

  it("hides the microphone when speech recognition is unavailable", () => {
    render(
      <YouTubePlanIdeaPane userIdea="Budget travel packing" loading={false} onIdeaChange={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /dictate video topic/i })).toBeNull();
  });

  it("keeps the Enhance Topic with AI Hub tooltip when the mic is hidden", () => {
    render(
      <YouTubePlanIdeaPane userIdea="Budget travel packing" loading={false} onIdeaChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /enhance topic with ai/i })).toHaveAttribute(
      "data-tooltip",
      "Use AI to offer three stronger topic options from your idea.",
    );
  });

  it("forwards idea edits", () => {
    const onIdeaChange = vi.fn();
    render(
      <YouTubePlanIdeaPane userIdea="Budget travel packing" loading={false} onIdeaChange={onIdeaChange} />,
    );
    fireEvent.change(screen.getByDisplayValue("Budget travel packing"), {
      target: { value: "Tokyo 48 hours" },
    });
    expect(onIdeaChange).toHaveBeenCalledWith("Tokyo 48 hours");
  });
});
