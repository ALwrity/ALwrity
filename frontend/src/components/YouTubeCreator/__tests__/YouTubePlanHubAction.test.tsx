import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePlanHubAction } from "../components/YouTubePlanHubAction";
import { YOUTUBE_PLAN_HUB_TOOLTIPS } from "../components/youtubePlanHubTooltips";

describe("YouTubePlanHubAction", () => {
  it("exposes a Hub data-tooltip and still fires click", () => {
    const onClick = vi.fn();
    render(
      <YouTubePlanHubAction tooltip={YOUTUBE_PLAN_HUB_TOOLTIPS.enhance} onClick={onClick}>
        Enhance Topic with AI
      </YouTubePlanHubAction>,
    );
    const button = screen.getByRole("button", { name: "Enhance Topic with AI" });
    expect(button).toHaveAttribute("data-tooltip", YOUTUBE_PLAN_HUB_TOOLTIPS.enhance);
    expect(button.className).toMatch(/yt-plan-hub-action/);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the Enhance tooltip on the wide primary CTA", () => {
    render(
      <YouTubePlanHubAction wide filled tooltip={YOUTUBE_PLAN_HUB_TOOLTIPS.enhance}>
        Enhance Topic with AI
      </YouTubePlanHubAction>,
    );
    const enhance = screen.getByRole("button", { name: "Enhance Topic with AI" });
    expect(enhance).toHaveAttribute("data-tooltip", YOUTUBE_PLAN_HUB_TOOLTIPS.enhance);
    expect(enhance.className).toMatch(/yt-plan-hub-action--wide/);
    expect(enhance.className).toMatch(/yt-plan-hub-action--selected/);
  });
});
