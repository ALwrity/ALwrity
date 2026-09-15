/**
 * Same PlanStatusProgressPanel chrome as Generate Pitch, for Enhance Topic with AI.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { YouTubePlanIdeaEnhanceProgressPanel } from "../components/YouTubePlanIdeaEnhanceProgressPanel";

describe("YouTubePlanIdeaEnhanceProgressPanel", () => {
  it("shows Hub status chrome for enhancing a topic", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<YouTubePlanIdeaEnhanceProgressPanel />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Enhancing topic/i)).toBeTruthy();
    expect(screen.getByText(/Loading Channel Bible context/i)).toBeTruthy();
    expect(screen.getByText("Generate three topics with llm_text_gen")).toBeTruthy();
    expect(info).toHaveBeenCalledWith(
      "[YouTubePlanIdeaEnhanceProgressPanel] Status started",
      expect.objectContaining({ stepCount: 4 }),
    );
    info.mockRestore();
  });
});
