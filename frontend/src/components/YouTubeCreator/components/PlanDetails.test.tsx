import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanDetails } from "./PlanDetails";
import type { VideoPlan } from "../../../services/youtubeApi";

jest.mock("../hooks/useAvatarBlobUrl", () => ({
  useAvatarBlobUrl: () => ({ avatarBlobUrl: null, avatarLoading: false }),
}));

const basePlan: VideoPlan = {
  video_summary: "How to travel cheaper",
  target_audience: "Travelers",
  video_goal: "Educate",
  key_message: "Book smarter",
  hook_strategy: "Open with a price tip",
  content_outline: [
    { section: "Hook", description: "Open", duration_estimate: 10 },
    { section: "Tips", description: "Core tips", duration_estimate: 20 },
  ],
  visual_style: "Clean",
  tone: "Friendly",
  seo_keywords: ["travel"],
  duration_type: "shorts",
  selected_title: "Budget Travel Tips",
  title_suggestions: ["Budget Travel Tips"],
};

describe("PlanDetails", () => {
  it("blocks save when a section name is empty", () => {
    const onPlanChange = jest.fn();
    render(<PlanDetails plan={basePlan} onPlanChange={onPlanChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    const sectionInputs = screen.getAllByLabelText(/Section name/i);
    fireEvent.change(sectionInputs[0], { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Each outline section needs a name.")).toBeInTheDocument();
    expect(onPlanChange).not.toHaveBeenCalled();
  });

  it("saves edited audience and keywords", () => {
    const onPlanChange = jest.fn();
    render(<PlanDetails plan={basePlan} onPlanChange={onPlanChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }));
    fireEvent.change(screen.getByLabelText("Target audience"), {
      target: { value: "Young professionals" },
    });
    fireEvent.change(screen.getByLabelText("New SEO keyword"), {
      target: { value: "bali" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add keyword" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target_audience: "Young professionals",
        seo_keywords: ["travel", "bali"],
        selected_title: "Budget Travel Tips",
      }),
    );
  });

  it("stays read-only when onPlanChange is omitted", () => {
    render(<PlanDetails plan={basePlan} />);

    expect(screen.queryByRole("button", { name: "Edit plan" })).not.toBeInTheDocument();
    expect(screen.getByText("Hook")).toBeInTheDocument();
  });
});
