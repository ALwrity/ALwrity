import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QualityCheckEngagementActions } from "../components/dashboard/QualityCheckEngagementActions";
import { OPEN_ENGAGEMENT_BOOSTER_EVENT } from "../utils/linkedInDashboardEvents";

describe("QualityCheckEngagementActions", () => {
  it("renders optimise CTA when content is present", () => {
    render(<QualityCheckEngagementActions content="Draft to polish" />);

    expect(
      screen.getByTestId("quality-check-engagement-actions"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Optimise for Engagement/i }),
    ).toBeTruthy();
  });

  it("shows low-score hint when overall score is below 80", () => {
    render(
      <QualityCheckEngagementActions content="Draft" overallScore={55} />,
    );

    expect(screen.getByText(/Score below 80/i)).toBeTruthy();
  });

  it("dispatches booster open event with draft content", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    render(<QualityCheckEngagementActions content="Quality draft" />);
    fireEvent.click(
      screen.getByRole("button", { name: /Optimise for Engagement/i }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "Quality draft" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });
});
