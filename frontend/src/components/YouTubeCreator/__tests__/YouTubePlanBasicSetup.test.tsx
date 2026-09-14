/**
 * Plan Your Video — duration, language, and independent aspect pills.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanBasicSetup } from "../components/YouTubePlanBasicSetup";
import "../components/youtubePlanLayout.css";

function renderSetup(
  overrides: Partial<React.ComponentProps<typeof YouTubePlanBasicSetup>> = {},
) {
  const props: React.ComponentProps<typeof YouTubePlanBasicSetup> = {
    durationType: "shorts",
    language: "en",
    aspectRatio: "9:16",
    disabled: false,
    onDurationChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onAspectRatioChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<YouTubePlanBasicSetup {...props} />), props };
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
    expect(screen.getByText(/Vertical bite-sized/i)).toBeTruthy();
  });

  it("marks the selected duration with Hub primary, not Podcast purple", () => {
    const { container } = renderSetup();
    const shorts = screen.getByRole("button", { name: "Shorts" });
    expect(shorts.className).toMatch(/yt-plan-pill--selected/);
    expect(container.innerHTML).not.toMatch(/667eea|#9c27b0|podcast/i);
  });

  it("states that aspect is saved on the draft and not sent to providers yet", () => {
    renderSetup();
    expect(
      screen.getByText(/saved on this draft/i),
    ).toBeTruthy();
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
});
