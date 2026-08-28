import React from "react";
import { render, screen } from "@testing-library/react";
import { YouTubeRadialWorkflow } from "../YouTubeRadialWorkflow";
import { computeYouTubeRadialLayout } from "../youtubeRadialLayout";
import { ConnectLockBadge } from "../../../LinkedInWriter/components/dashboard/ConnectLockIcon";
import { PLAN_PINNED_HINT_KEY, resolveYouTubeWorkflowIcon } from "../youtubeWorkflowConfig";

describe("YouTubeRadialWorkflow", () => {
  it("resolves every workflow icon", () => {
    expect(typeof ConnectLockBadge).toBe("function");
    for (const id of [
      "plan",
      "create",
      "publish",
      "analysis",
      "engagement",
      "remarket",
    ] as const) {
      expect(resolveYouTubeWorkflowIcon(id)).toBeTruthy();
    }
  });

  it("renders disconnected radial workflow without invalid element types", () => {
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });
    expect(() =>
      render(
        <YouTubeRadialWorkflow
          layout={layout}
          onCardAction={() => undefined}
          connected={false}
        />,
      ),
    ).not.toThrow();
  });

  it("always shows START HERE on the Plan wedge even after hint dismiss", () => {
    sessionStorage.setItem(PLAN_PINNED_HINT_KEY, "1");
    const layout = computeYouTubeRadialLayout(800, {
      maxHeight: 640,
      desktopViewport: true,
    });

    render(
      <YouTubeRadialWorkflow
        layout={layout}
        onCardAction={() => undefined}
        connected={false}
      />,
    );

    expect(screen.getByText("START")).toBeTruthy();
    expect(screen.getByText("HERE")).toBeTruthy();
    sessionStorage.removeItem(PLAN_PINNED_HINT_KEY);
  });
});
