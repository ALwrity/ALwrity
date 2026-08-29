import {
  resolveWorkflowWedgeDetail,
  openWorkflowWedge,
  openPerformancePulse,
  OPEN_WORKFLOW_WEDGE_EVENT,
  buildContentAnalyticsReturnTarget,
} from "../components/dashboard/workflowWedgeNavigation";

describe("workflowWedgeNavigation", () => {
  describe("resolveWorkflowWedgeDetail", () => {
    it("redirects legacy engagement+pulse to remarket+pulse", () => {
      expect(
        resolveWorkflowWedgeDetail({ wedge: "engagement", sub: "pulse" }),
      ).toEqual({ wedge: "remarket", sub: "pulse" });
    });

    it("preserves returnTo when remapping legacy engagement pulse", () => {
      const returnTo = buildContentAnalyticsReturnTarget(true);
      expect(
        resolveWorkflowWedgeDetail({
          wedge: "engagement",
          sub: "pulse",
          returnTo,
        }),
      ).toEqual({ wedge: "remarket", sub: "pulse", returnTo });
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
      const handler = vi.fn();
      window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);

      openWorkflowWedge({ wedge: "engagement", sub: "pulse" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ wedge: "remarket", sub: "pulse" });

      window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);
    });
  });

  describe("openPerformancePulse", () => {
    it("opens remarket pulse with Content Analytics return target", () => {
      const handler = vi.fn();
      window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);

      openPerformancePulse();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({
        wedge: "remarket",
        sub: "pulse",
        returnTo: buildContentAnalyticsReturnTarget(undefined),
      });

      window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);
    });

    it("preserves Analysis wedge context in return target", () => {
      const handler = vi.fn();
      window.addEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);

      openPerformancePulse({ fromAnalysisWedge: true });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.returnTo).toEqual(
        buildContentAnalyticsReturnTarget(true),
      );

      window.removeEventListener(OPEN_WORKFLOW_WEDGE_EVENT, handler);
    });
  });
});
