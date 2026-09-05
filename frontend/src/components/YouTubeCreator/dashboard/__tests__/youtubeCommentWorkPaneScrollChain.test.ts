/**
 * When the Comment Reply Assistant work pane is at a scroll edge,
 * remaining wheel delta should move .yt-modal-body (nested scroll chain).
 */
import {
  youtubeCommentChainWorkPaneWheel,
  youtubeCommentFindModalBody,
  youtubeCommentWorkPaneShouldChainScroll,
} from "../youtubeCommentWorkPaneScrollChain";

describe("youtubeCommentWorkPaneScrollChain", () => {
  it("chains downward only when the work pane is at the bottom", () => {
    const pane = { scrollTop: 80, scrollHeight: 200, clientHeight: 120 };
    expect(youtubeCommentWorkPaneShouldChainScroll(pane, 40)).toBe(true);
    expect(youtubeCommentWorkPaneShouldChainScroll({ ...pane, scrollTop: 0 }, 40)).toBe(
      false,
    );
  });

  it("chains upward only when the work pane is at the top", () => {
    const pane = { scrollTop: 0, scrollHeight: 200, clientHeight: 120 };
    expect(youtubeCommentWorkPaneShouldChainScroll(pane, -40)).toBe(true);
    expect(youtubeCommentWorkPaneShouldChainScroll({ ...pane, scrollTop: 40 }, -40)).toBe(
      false,
    );
  });

  it("chains to the outer pane when inner content does not overflow", () => {
    const pane = { scrollTop: 0, scrollHeight: 100, clientHeight: 100 };
    expect(youtubeCommentWorkPaneShouldChainScroll(pane, 30)).toBe(true);
    expect(youtubeCommentWorkPaneShouldChainScroll(pane, -30)).toBe(true);
  });

  it("finds .yt-modal-body as the outer scroll pane", () => {
    const outer = document.createElement("div");
    outer.className = "yt-modal-body";
    const inner = document.createElement("div");
    outer.appendChild(inner);
    expect(youtubeCommentFindModalBody(inner)).toBe(outer);
    expect(youtubeCommentFindModalBody(document.createElement("div"))).toBeNull();
  });

  it("moves the modal body scrollTop when chaining and skips when not at the edge", () => {
    const outer = document.createElement("div");
    outer.className = "yt-modal-body";
    outer.scrollTop = 10;
    const pane = document.createElement("div");
    Object.defineProperty(pane, "scrollTop", { value: 80, writable: true });
    Object.defineProperty(pane, "scrollHeight", { value: 200 });
    Object.defineProperty(pane, "clientHeight", { value: 120 });
    outer.appendChild(pane);

    expect(youtubeCommentChainWorkPaneWheel(pane, 24)).toBe(true);
    expect(outer.scrollTop).toBe(34);

    Object.defineProperty(pane, "scrollTop", { value: 0, writable: true });
    expect(youtubeCommentChainWorkPaneWheel(pane, 24)).toBe(false);
    expect(outer.scrollTop).toBe(34);
  });
});
