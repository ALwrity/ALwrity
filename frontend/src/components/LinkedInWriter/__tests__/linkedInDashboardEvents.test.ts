import {
  OPEN_ENGAGEMENT_BOOSTER_EVENT,
  OPEN_GROWTH_ENGINE_EVENT,
  OPEN_POST_ANALYTICS_EVENT,
  openEngagementBoosterModal,
  openGrowthEngineModal,
  openPostAnalyticsModal,
} from "../utils/linkedInDashboardEvents";

describe("linkedInDashboardEvents", () => {
  it("openPostAnalyticsModal dispatches the correct event", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_POST_ANALYTICS_EVENT, handler);

    openPostAnalyticsModal();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_POST_ANALYTICS_EVENT, handler);
  });

  it("openGrowthEngineModal dispatches the correct event", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_GROWTH_ENGINE_EVENT, handler);

    openGrowthEngineModal();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_GROWTH_ENGINE_EVENT, handler);
  });

  it("openEngagementBoosterModal dispatches with empty detail by default", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    openEngagementBoosterModal();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({});
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });

  it("openEngagementBoosterModal passes initialContent in detail", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);

    openEngagementBoosterModal({ initialContent: "Hello draft" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ initialContent: "Hello draft" });
    window.removeEventListener(OPEN_ENGAGEMENT_BOOSTER_EVENT, handler);
  });
});
