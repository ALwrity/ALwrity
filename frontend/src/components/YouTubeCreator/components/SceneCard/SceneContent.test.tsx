import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { Scene } from "../../../../services/youtubeApi";
import { SceneContent } from "./SceneContent";

const theme = createTheme();

function renderScene(scene: Scene) {
  return render(
    <ThemeProvider theme={theme}>
      <SceneContent scene={scene} />
    </ThemeProvider>,
  );
}

const baseScene: Scene = {
  scene_number: 1,
  title: "Hook",
  narration: "Want titles that explode clicks? Watch this!",
  visual_prompt: "",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
};

describe("SceneContent visual prompt", () => {
  it("shows enhanced visual in the yellow box when visual_prompt is empty", () => {
    renderScene({
      ...baseScene,
      enhanced_visual_prompt: "Same creator in a sunlit kitchen, she leans toward camera.",
    });

    expect(screen.getByText("Visual Prompt")).toBeInTheDocument();
    expect(
      screen.getByText("Same creator in a sunlit kitchen, she leans toward camera."),
    ).toBeInTheDocument();
  });

  it("prefers visual_prompt when both fields are set", () => {
    renderScene({
      ...baseScene,
      visual_prompt: "Calendar highlighting Tuesday",
      enhanced_visual_prompt: "A different cinematic kitchen shot",
    });

    expect(screen.getByText("Calendar highlighting Tuesday")).toBeInTheDocument();
    expect(screen.queryByText("A different cinematic kitchen shot")).not.toBeInTheDocument();
  });
});
