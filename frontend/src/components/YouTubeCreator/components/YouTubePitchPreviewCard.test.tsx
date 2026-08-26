import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePitchPreviewCard } from "./YouTubePitchPreviewCard";

const pitch = {
  id: "p1",
  creative_angle: "Storytelling",
  selected_title: "My Video Title",
  video_summary: "Short summary of the pitch.",
  hook_concept: "Open with a personal story.",
  main_content_beats: ["Setup", "Conflict", "Payoff"],
};

describe("YouTubePitchPreviewCard", () => {
  it("renders title, summary, hook, and beats without metadata chips", () => {
    render(<YouTubePitchPreviewCard pitch={pitch} />);

    expect(screen.getByText("My Video Title")).toBeInTheDocument();
    expect(screen.getByText("Short summary of the pitch.")).toBeInTheDocument();
    expect(screen.getByText("Open with a personal story.")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.queryByText("Target Audience")).not.toBeInTheDocument();
    expect(screen.queryByText("SEO Keywords")).not.toBeInTheDocument();
  });

  it("selects a history pitch", () => {
    const onSelectHistoryPitch = vi.fn();
    const older = { ...pitch, id: "p2", selected_title: "Second pitch" };
    render(
      <YouTubePitchPreviewCard
        pitch={pitch}
        history={[pitch, older]}
        onSelectHistoryPitch={onSelectHistoryPitch}
      />,
    );

    fireEvent.click(screen.getByText("Second pitch"));
    expect(onSelectHistoryPitch).toHaveBeenCalledWith(older);
  });
});
