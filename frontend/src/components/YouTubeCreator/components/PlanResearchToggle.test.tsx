import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanResearchToggle } from "./PlanResearchToggle";

describe("PlanResearchToggle", () => {
  it("toggles research on and off", () => {
    const onChange = vi.fn();
    render(<PlanResearchToggle enabled={true} onChange={onChange} />);

    expect(screen.getByLabelText("Enable web research for plan")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Enable web research for plan"));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
