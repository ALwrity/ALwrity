import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanMetaFieldsEditor, type PlanMetaFields } from "./PlanMetaFieldsEditor";

const baseValue: PlanMetaFields = {
  target_audience: "Travelers",
  video_goal: "Educate",
  key_message: "Book smarter",
  call_to_action: "Subscribe",
  visual_style: "Clean",
  tone: "Friendly",
  seo_keywords: ["travel"],
};

describe("PlanMetaFieldsEditor", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates target audience", () => {
    render(<PlanMetaFieldsEditor value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Target audience"), {
      target: { value: "Young professionals" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      target_audience: "Young professionals",
    });
  });

  it("adds a keyword", () => {
    render(<PlanMetaFieldsEditor value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("New SEO keyword"), {
      target: { value: "bali" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add keyword" }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      seo_keywords: ["travel", "bali"],
    });
  });

  it("does not add a duplicate keyword", () => {
    render(<PlanMetaFieldsEditor value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("New SEO keyword"), {
      target: { value: "Travel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add keyword" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
