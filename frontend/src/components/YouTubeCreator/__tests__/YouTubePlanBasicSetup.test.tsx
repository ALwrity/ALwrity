/**
 * Plan Your Video — duration, language, and independent aspect pills.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanBasicSetup } from "../components/YouTubePlanBasicSetup";
import "../components/youtubePlanLayout.css";

type BasicSetupTestProps = React.ComponentProps<typeof YouTubePlanBasicSetup> & {
  planCategory?: "kids" | "explainer" | "";
  onPlanCategoryChange?: (category: "kids" | "explainer" | "") => void;
};

function renderSetup(overrides: Partial<BasicSetupTestProps> = {}) {
  const props: BasicSetupTestProps = {
    durationType: "shorts",
    language: "en",
    aspectRatio: "9:16",
    disabled: false,
    onDurationChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onAspectRatioChange: vi.fn(),
    planCategory: "",
    onPlanCategoryChange: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<YouTubePlanBasicSetup {...(props as React.ComponentProps<typeof YouTubePlanBasicSetup>)} />),
    props,
  };
}

describe("YouTubePlanBasicSetup", () => {
  it("calls onDurationChange with shorts from the Shorts pill", () => {
    const { props } = renderSetup({ durationType: "medium", aspectRatio: "16:9" });
    fireEvent.click(screen.getByRole("button", { name: "Shorts" }));
    expect(props.onDurationChange).toHaveBeenCalledWith("shorts");
    expect(props.onAspectRatioChange).not.toHaveBeenCalled();
  });

  it("calls onAspectRatioChange from the 16:9 pill without changing duration", () => {
    const { props } = renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(props.onAspectRatioChange).toHaveBeenCalledWith("16:9");
    expect(props.onDurationChange).not.toHaveBeenCalled();
  });

  it("shows the Shorts duration hint", () => {
    renderSetup();
    expect(screen.getAllByText(/Vertical bite-sized/i).length).toBeGreaterThan(0);
  });

  it("marks the selected duration with Hub primary, not Podcast purple", () => {
    const { container } = renderSetup();
    const shorts = screen.getByRole("button", { name: "Shorts" });
    expect(shorts.className).toMatch(/yt-plan-hub-action--selected/);
    expect(shorts).toHaveAttribute("data-tooltip", "Vertical bite-sized (≤60s).");
    expect(screen.getByRole("button", { name: "9:16" })).toHaveAttribute(
      "data-tooltip",
      expect.stringMatching(/9:16/),
    );
    expect(container.innerHTML).not.toMatch(/667eea|#9c27b0|podcast/i);
  });

  it("states that aspect is saved on the draft and not sent to providers yet", () => {
    renderSetup();
    expect(screen.getAllByText(/saved on this draft/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/still use today's provider sizes until a follow-up/i),
    ).toBeTruthy();
  });

  it("keeps the pitch/script/audio language helper", () => {
    renderSetup();
    expect(
      screen.getByText(/Pitch, script, and default audio use this language/i),
    ).toBeTruthy();
  });

  it("forwards a language change", () => {
    const { props } = renderSetup();
    fireEvent.mouseDown(screen.getByText("English"));
    fireEvent.click(screen.getByRole("option", { name: "Hindi" }));
    expect(props.onLanguageChange).toHaveBeenCalledWith("hi");
  });

  it("logs and swallows a throwing aspect handler so Plan stays usable", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderSetup({
      onAspectRatioChange: () => {
        throw new Error("aspect persist failed");
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(error).toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Basic setup" })).toBeTruthy();
    error.mockRestore();
  });

  it("wraps controls in a numbered step 2 card", () => {
    renderSetup();
    expect(screen.getByRole("region", { name: "Basic setup" })).toHaveClass("yt-plan-pane");
    expect(screen.getByLabelText("Step 2")).toBeTruthy();
  });

  it("exposes Hub Kids and Explainer category pills", () => {
    const { container, props } = renderSetup();
    const kids = screen.getByRole("button", { name: "Kids" });
    const explainer = screen.getByRole("button", { name: "Explainer" });
    expect(kids.className).toMatch(/yt-plan-hub-action--tip-above/);
    expect(explainer.className).toMatch(/yt-plan-hub-action--tip-above/);
    expect(kids).toHaveAttribute("data-tooltip");
    expect(explainer).toHaveAttribute("data-tooltip");
    expect(container.innerHTML).not.toMatch(/667eea|#9c27b0|podcast/i);
    fireEvent.click(kids);
    expect(props.onPlanCategoryChange).toHaveBeenCalledWith("kids");
    fireEvent.click(explainer);
    expect(props.onPlanCategoryChange).toHaveBeenCalledWith("explainer");
  });

  it("marks the selected category with Hub primary", () => {
    renderSetup({ planCategory: "explainer" });
    expect(screen.getByRole("button", { name: "Explainer" }).className).toMatch(
      /yt-plan-hub-action--selected/,
    );
    expect(screen.getByRole("button", { name: "Kids" }).className).not.toMatch(
      /yt-plan-hub-action--selected/,
    );
  });

  it("clears the category when the selected pill is clicked again", () => {
    const { props } = renderSetup({ planCategory: "kids" });
    fireEvent.click(screen.getByRole("button", { name: "Kids" }));
    expect(props.onPlanCategoryChange).toHaveBeenCalledWith("");
  });
});
