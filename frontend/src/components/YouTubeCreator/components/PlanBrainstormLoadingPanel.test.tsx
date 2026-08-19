import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { PlanBrainstormLoadingPanel } from "./PlanBrainstormLoadingPanel";

describe("PlanBrainstormLoadingPanel", () => {
  it("shows the first loader message at index 0", () => {
    render(<PlanBrainstormLoadingPanel loaderMessageIndex={0} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Generating video ideas/i)).toBeInTheDocument();
    expect(screen.getByText(/Searching the web for recent coverage/i)).toBeInTheDocument();
  });

  it("advances the loader message with the index", () => {
    render(<PlanBrainstormLoadingPanel loaderMessageIndex={2} />);

    expect(screen.getByText(/Aligning ideas with your Channel Bible/i)).toBeInTheDocument();
  });
});
