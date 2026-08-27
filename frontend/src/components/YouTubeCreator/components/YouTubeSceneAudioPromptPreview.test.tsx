import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { YouTubeSceneAudioPromptPreview } from "./YouTubeSceneAudioPromptPreview";

describe("YouTubeSceneAudioPromptPreview", () => {
  it("shows narration as the voice text that will be sent", () => {
    render(
      <YouTubeSceneAudioPromptPreview
        inputText="Open with a question."
        deliveryNotes="Hook. Open with a question. [Speak at a natural, conversational pace]"
      />,
    );

    expect(screen.getByText(/scene narration only/i)).toBeInTheDocument();
    expect(screen.getByText("Open with a question.")).toBeInTheDocument();
    expect(screen.getByText(/Delivery notes \(not spoken\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\[Speak at a natural, conversational pace\]/)).toBeInTheDocument();
  });
});
