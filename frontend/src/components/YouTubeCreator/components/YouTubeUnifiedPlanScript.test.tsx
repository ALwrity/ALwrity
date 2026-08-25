import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeUnifiedPlanScript } from "./YouTubeUnifiedPlanScript";

describe("YouTubeUnifiedPlanScript", () => {
  it("fires onChange when editing script text", () => {
    const onChange = vi.fn();
    render(<YouTubeUnifiedPlanScript value="Hello script" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Full video script"), {
      target: { value: "Updated script" },
    });
    expect(onChange).toHaveBeenCalledWith("Updated script");
  });

  it("does not render audience/goal/SEO chip labels", () => {
    render(<YouTubeUnifiedPlanScript value="Spoken hook and body." />);
    expect(screen.queryByText("Target Audience")).not.toBeInTheDocument();
    expect(screen.queryByText("Key Message")).not.toBeInTheDocument();
    expect(screen.queryByText("SEO Keywords")).not.toBeInTheDocument();
  });
});
