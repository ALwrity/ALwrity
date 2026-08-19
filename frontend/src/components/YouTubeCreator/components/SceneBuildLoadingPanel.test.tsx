import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { SceneBuildLoadingPanel } from "./SceneBuildLoadingPanel";

describe("SceneBuildLoadingPanel", () => {
  it("shows scene-build status, first message, and pipeline steps", () => {
    render(<SceneBuildLoadingPanel />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Building scenes from plan/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Reading your plan outline, hook, and CTA/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Generate scenes with llm_text_gen")).toBeInTheDocument();
    expect(screen.getByText("Enhance visual prompts")).toBeInTheDocument();
    expect(screen.getByText(/typical steps, not a live server percentage/i)).toBeInTheDocument();
  });
});
