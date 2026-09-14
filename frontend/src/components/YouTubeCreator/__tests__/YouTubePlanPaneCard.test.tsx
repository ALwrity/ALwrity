/**
 * Plan pane numbered cards (idea vs basic setup) — Hub chrome, not Podcast purple.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { YouTubePlanPaneCard } from "../components/YouTubePlanPaneCard";
import "../components/youtubePlanLayout.css";

describe("YouTubePlanPaneCard", () => {
  it("renders a numbered Hub card without Podcast purple", () => {
    const { container } = render(
      <YouTubePlanPaneCard step={1} title="Your idea" subtitle="Topic first" ariaLabel="Your idea">
        <p>canvas</p>
      </YouTubePlanPaneCard>,
    );

    expect(screen.getByRole("region", { name: "Your idea" })).toHaveClass("yt-plan-pane");
    expect(screen.getByLabelText("Step 1")).toHaveTextContent("1");
    expect(screen.getByText("Your idea")).toBeTruthy();
    expect(screen.getByText("Topic first")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/667eea|#9c27b0|podcast/i);
  });
});
