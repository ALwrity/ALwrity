import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentCoachFullRewriteBanner } from "../components/dashboard/ContentCoachFullRewriteBanner";
import { OPEN_ENGAGEMENT_BOOSTER_EVENT } from "../utils/linkedInDashboardEvents";

describe("ContentCoachFullRewriteBanner", () => {
  it("renders nothing when draft is empty", () => {
    const { container } = render(<ContentCoachFullRewriteBanner draft="" />);
    expect(container.firstChild).toBeNull();
  });

  it("opens engagement booster with draft and calls onBeforeOpen", () => {
    const onBeforeOpen = jest.fn();
    const handler = jest.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(
      <ContentCoachFullRewriteBanner
        draft="Coach draft text"
        onBeforeOpen={onBeforeOpen}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Optimise for Engagement/i }),
    );

    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "Coach draft text" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });
});
