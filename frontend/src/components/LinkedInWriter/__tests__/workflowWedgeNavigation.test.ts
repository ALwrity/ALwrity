import {
  resolveWorkflowWedgeDetail,
  openWorkflowWedge,
  openPerformancePulse,
  OPEN_WORKFLOW_WEDGE_EVENT,
} from "../components/dashboard/workflowWedgeNavigation";

describe("workflowWedgeNavigation", () => {
  describe("resolveWorkflowWedgeDetail", () => {
    it("redirects legacy engagement+pulse to remarket+pulse", () => {
      expect(
        resolveWorkflowWedgeDetail({ wedge: "engagement", sub: "pulse" }),
      ).toEqual({ wedge: "remarket", sub: "pulse" });
    });

    it("passes through remarket+pulse unchanged", () => {
      expect(
        resolveWorkflowWedgeDetail({ wedge: "remarket", sub: "pulse" }),
      ).toEqual({ wedge: "remarket", sub: "pulse" });
    });

    it("passes through engagement subs unchanged", () => {
      expect(
        resolveWorkflowWedgeDetail({ wedge: "engagement", sub: "comment" }),
      ).toEqual({ wedge: "engagement", sub: "comment" });
    });
  });

  describe("openWorkflowWedge", () => {
    it("dispatches resolved detail for legacy engagement pulse deep link", () => {
      const handler = jest.fn();
      window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);

      openWorkflowWedge({ wedge: "engagement", sub: "pulse" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ wedge: "remarket", sub: "pulse" });

      window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);
    });
  });

  describe("openPerformancePulse", () => {
    it("opens remarket pulse sub-modal", () => {
      const handler = jest.fn();
      window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);

      openPerformancePulse();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ wedge: "remarket", sub: "pulse" });

      window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);
    });
  });
});
