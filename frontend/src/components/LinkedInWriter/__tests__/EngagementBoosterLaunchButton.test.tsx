import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EngagementBoosterLaunchButton } from "../components/dashboard/EngagementBoosterLaunchButton";
import { OPEN_ENGAGEMENT_BOOSTER_EVENT } from "../utils/linkedInDashboardEvents";

describe("EngagementBoosterLaunchButton", () => {
  it("panel variant dispatches open event with content", () => {
    const handler = vi.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <EngagementBoosterLaunchButton content="My draft text" variant="panel" />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Optimise for Engagement/i }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "My draft text" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });

  it("panel variant does not dispatch when disabled", () => {
    const handler = vi.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <EngagementBoosterLaunchButton content="" variant="panel" disabled />,
    );

    const btn = screen.getByRole("button", {
      name: /Optimise for Engagement/i,
    });
    expect(btn).toHaveProperty("disabled", true);
    fireEvent.click(btn);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });

  it("toolbar variant dispatches open event", () => {
    const handler = vi.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <EngagementBoosterLaunchButton
        content="Editor draft"
        variant="toolbar"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Optimise$/i }));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "Editor draft" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });

  it("inline variant dispatches open event for draft library rows", () => {
    const handler = vi.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <EngagementBoosterLaunchButton
        content="Saved draft"
        variant="inline"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^⚡ Optimise$/i }));

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "Saved draft" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });

  it("calls onBeforeOpen before dispatching", () => {
    const onBeforeOpen = vi.fn();
    const handler = vi.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <EngagementBoosterLaunchButton
        content="Draft"
        onBeforeOpen={onBeforeOpen}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Optimise for Engagement/i }),
    );
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });
});
