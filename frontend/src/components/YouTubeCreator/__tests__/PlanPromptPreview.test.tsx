/**
 * Plan Your Video Phase 2: prompt accordion uses pitch preview API.
 * Component test — Jest + React Testing Library (TESTING.md).
 */

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanPromptPreview } from "../components/PlanPromptPreview";
import { youtubeApi } from "../../../services/youtubeApi";

jest.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    previewPitchPrompt: jest.fn(),
  },
}));

describe("PlanPromptPreview pitch builder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not fetch until idea and creative angle are present", async () => {
    const user = userEvent.setup();
    render(
      <PlanPromptPreview
        userIdea=""
        durationType="shorts"
        language="hi"
        enableResearch
        creativeAngle=""
      />,
    );

    await user.click(screen.getByText("Prompt that will be sent"));
    expect(
      screen.getByText(/Enter a video idea and creative angle/i),
    ).toBeInTheDocument();
    expect(youtubeApi.previewPitchPrompt).not.toHaveBeenCalled();
  });

  it("loads the pitch preview API with angle and language", async () => {
    const user = userEvent.setup();
    jest.mocked(youtubeApi.previewPitchPrompt).mockResolvedValue({
      success: true,
      system_prompt: "You are ALwrity's YouTube Script Architect.",
      user_prompt:
        'Create ONE short video pitch for: "Budget travel"\n**Creative angle (primary lens):** Contrarian',
      message: "ok",
    });

    render(
      <PlanPromptPreview
        userIdea="Budget travel"
        durationType="shorts"
        language="hi"
        enableResearch
        creativeAngle="Contrarian"
      />,
    );

    await user.click(screen.getByText("Prompt that will be sent"));

    await waitFor(
      () => {
        expect(youtubeApi.previewPitchPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            user_idea: "Budget travel",
            creative_angle: "Contrarian",
            language: "hi",
            enable_research: true,
          }),
        );
      },
      { timeout: 3000 },
    );

    expect(await screen.findByText(/Create ONE short video pitch/)).toBeInTheDocument();
    expect(screen.queryByText(/Create a YouTube video plan/i)).not.toBeInTheDocument();
  });
});
