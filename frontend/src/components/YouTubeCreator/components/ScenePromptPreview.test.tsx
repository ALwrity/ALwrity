import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ScenePromptPreview } from "./ScenePromptPreview";
import type { VideoPlan } from "../../../services/youtubeApi";

const plan: VideoPlan = {
  video_summary: "Budget travel tips",
  target_audience: "Travelers",
  content_outline: [
    { section: "Hook", description: "Open strong", duration_estimate: 10 },
  ],
  hook_strategy: "Ask a question",
  visual_style: "cinematic",
  seo_keywords: [],
  duration_type: "medium",
};

describe("ScenePromptPreview", () => {
  it("shows scene-build prompt template before generate", () => {
    render(<ScenePromptPreview plan={plan} />);

    expect(screen.getByText("Prompt that will be sent to build scenes")).toBeInTheDocument();
    expect(screen.getByText(/Budget travel tips/)).toBeInTheDocument();
    expect(screen.getByText(/Open strong/)).toBeInTheDocument();
  });
});
