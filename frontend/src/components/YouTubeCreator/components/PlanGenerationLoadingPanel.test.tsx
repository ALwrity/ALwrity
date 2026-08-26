import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PlanGenerationLoadingPanel } from "./PlanGenerationLoadingPanel";

describe("PlanGenerationLoadingPanel", () => {
  it("shows plan generation status and Exa step when research is on", () => {
    render(<PlanGenerationLoadingPanel enableResearch />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Generating pitch/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Loading Channel Bible and persona defaults/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Apply Channel Bible and persona")).toBeInTheDocument();
    expect(screen.getByText("Search the web via Exa")).toBeInTheDocument();
  });

  it("omits the Exa step when research is off", () => {
    render(<PlanGenerationLoadingPanel enableResearch={false} />);

    expect(screen.getByText(/Generating pitch/i)).toBeInTheDocument();
    expect(screen.queryByText(/Search the web via Exa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Generate the pitch with llm_text_gen/i)).toBeInTheDocument();
  });
});
