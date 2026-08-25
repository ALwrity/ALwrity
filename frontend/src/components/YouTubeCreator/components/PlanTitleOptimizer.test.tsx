import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanTitleOptimizer } from "./PlanTitleOptimizer";

describe("PlanTitleOptimizer", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects a title chip", () => {
    render(
      <PlanTitleOptimizer
        titleSuggestions={["Budget Bali", "Cheap Travel Tips"]}
        selectedTitle="Budget Bali"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Cheap Travel Tips"));

    expect(onChange).toHaveBeenCalledWith({
      titleSuggestions: ["Budget Bali", "Cheap Travel Tips"],
      selectedTitle: "Cheap Travel Tips",
    });
  });

  it("adds a custom title and selects it", () => {
    render(
      <PlanTitleOptimizer
        titleSuggestions={["Budget Bali"]}
        selectedTitle="Budget Bali"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Custom video title"), {
      target: { value: "My Custom Title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledWith({
      titleSuggestions: ["Budget Bali", "My Custom Title"],
      selectedTitle: "My Custom Title",
    });
  });

  it("does not show delete on the last remaining title", () => {
    render(
      <PlanTitleOptimizer
        titleSuggestions={["Only Title"]}
        selectedTitle="Only Title"
        onChange={onChange}
      />,
    );

    expect(screen.queryByTestId("CancelIcon")).not.toBeInTheDocument();
  });

  it("uses readable contrast on unselected title chips", () => {
    render(
      <PlanTitleOptimizer
        titleSuggestions={["Budget Bali", "Cheap Travel Tips"]}
        selectedTitle="Budget Bali"
        onChange={onChange}
      />,
    );

    const unselected = screen.getByText("Cheap Travel Tips");
    expect(unselected).toHaveStyle({ color: "#111827" });
  });

  it("hides add controls when disabled", () => {
    render(
      <PlanTitleOptimizer
        titleSuggestions={["Budget Bali"]}
        selectedTitle="Budget Bali"
        disabled
        onChange={onChange}
      />,
    );

    expect(screen.queryByLabelText("Custom video title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Budget Bali", { selector: ".MuiChip-label" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
