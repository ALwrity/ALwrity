import {
  OPEN_GROW_NETWORK_EVENT,
  openGrowNetworkModal,
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
