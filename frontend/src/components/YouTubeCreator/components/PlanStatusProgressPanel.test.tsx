import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PlanStatusProgressPanel } from "./PlanStatusProgressPanel";

describe("PlanStatusProgressPanel", () => {
  it("renders title, message, steps, and optional hint", () => {
    render(
      <PlanStatusProgressPanel
        title="Generating video plan"
        message="Building the planning prompt..."
        progress={40}
        steps={["Apply Channel Bible and persona", "Generate the plan with llm_text_gen"]}
        hint="This can take about a minute."
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Generating video plan")).toBeInTheDocument();
    expect(screen.getByText("Building the planning prompt...")).toBeInTheDocument();
    expect(screen.getByText("Apply Channel Bible and persona")).toBeInTheDocument();
    expect(screen.getByText(/about a minute/i)).toBeInTheDocument();
  });
});
