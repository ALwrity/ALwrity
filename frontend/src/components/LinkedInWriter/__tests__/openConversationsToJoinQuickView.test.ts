import {
  CLOSE_GROWTH_ENGINE_FOR_QUICK_VIEW_EVENT,
  openConversationsToJoinQuickView,
} from "../components/dashboard/openConversationsToJoinQuickView";
import { OPEN_WORKFLOW_WEDGE_EVENT } from "../components/dashboard/workflowWedgeNavigation";

describe("openConversationsToJoinQuickView", () => {
  it("closes Growth Engine and opens engagement opportunities sub-modal", () => {
    const closeHandler = jest.fn();
    const wedgeHandler = jest.fn();
    window.addEventListener(
      CLOSE_GROWTH_ENGINE_FOR_QUICK_VIEW_EVENT,
      closeHandler,
    );
    window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, wedgeHandler);

    openConversationsToJoinQuickView();

    expect(closeHandler).toHaveBeenCalledTimes(1);
    expect(wedgeHandler).toHaveBeenCalledTimes(1);
    const event = wedgeHandler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      wedge: "engagement",
      sub: "opportunities",
    });

    window.removeEventListener(
      CLOSE_GROWTH_ENGINE_FOR_QUICK_VIEW_EVENT,
      closeHandler,
    );
    window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, wedgeHandler);
  });
});
