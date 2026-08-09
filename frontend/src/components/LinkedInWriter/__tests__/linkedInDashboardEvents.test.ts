import {
  OPEN_GROW_NETWORK_EVENT,
  OPEN_GROWTH_ENGINE_EVENT,
  OPEN_POST_ANALYTICS_EVENT,
  openGrowNetworkModal,
  openGrowthEngineModal,
  openPostAnalyticsModal,
} from "../utils/linkedInDashboardEvents";

describe("openGrowNetworkModal", () => {
  it("dispatches OPEN_GROW_NETWORK_EVENT with scroll detail", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_GROW_NETWORK_EVENT, handler);

    openGrowNetworkModal({ scrollToSection: "live-linkedin" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ scrollToSection: "live-linkedin" });

    window.removeEventListener(OPEN_GROW_NETWORK_EVENT, handler);
  });

  it("dispatches empty detail when no scroll target", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_GROW_NETWORK_EVENT, handler);

    openGrowNetworkModal();

    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({});

    window.removeEventListener(OPEN_GROW_NETWORK_EVENT, handler);
  });
});

describe("openPostAnalyticsModal", () => {
  it("dispatches fromAnalysisWedge detail when opened from Analysis wedge", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_POST_ANALYTICS_EVENT, handler);

    openPostAnalyticsModal({ fromAnalysisWedge: true });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ fromAnalysisWedge: true });

    window.removeEventListener(OPEN_POST_ANALYTICS_EVENT, handler);
  });
});

describe("openGrowthEngineModal", () => {
  it("dispatches fromEngagementWedge detail when opened from Engagement wedge", () => {
    const handler = jest.fn();
    window.addEventListener(OPEN_GROWTH_ENGINE_EVENT, handler);

    openGrowthEngineModal({ fromEngagementWedge: true });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ fromEngagementWedge: true });

    window.removeEventListener(OPEN_GROWTH_ENGINE_EVENT, handler);
  });
});
