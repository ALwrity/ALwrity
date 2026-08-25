import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanOutlineEditor } from "./PlanOutlineEditor";
import type { OutlineItem } from "../utils/planOutlineHelpers";

const baseItems: OutlineItem[] = [
  { id: "a", section: "Hook", description: "Open strong", duration_estimate: 10 },
  { id: "b", section: "Tips", description: "Core advice", duration_estimate: 20 },
];

describe("PlanOutlineEditor", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a section name", () => {
    render(<PlanOutlineEditor items={baseItems} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Section name a"), {
      target: { value: "New Hook" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { ...baseItems[0], section: "New Hook" },
      baseItems[1],
    ]);
  });

  it("adds a section", () => {
    render(<PlanOutlineEditor items={baseItems} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as OutlineItem[];
    expect(next).toHaveLength(3);
    expect(next[2].section).toBe("");
    expect(next[2].duration_estimate).toBe(10);
  });

  it("does not delete the last remaining section", () => {
    render(
      <PlanOutlineEditor
        items={[{ id: "only", section: "Hook", description: "Open", duration_estimate: 10 }]}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Delete section")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Delete section"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables Add section at maxSections", () => {
    render(<PlanOutlineEditor items={baseItems} maxSections={2} onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
  });

  it("warns when duration is far from the target", () => {
    render(
      <PlanOutlineEditor
        items={baseItems}
        targetSeconds={200}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/more than 20% away from the target/i)).toBeInTheDocument();
  });
});
