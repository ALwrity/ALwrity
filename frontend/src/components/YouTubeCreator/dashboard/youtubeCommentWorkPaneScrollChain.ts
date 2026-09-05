const YOUTUBE_COMMENT_WORK_PANE_SCROLL_EDGE_PX = 1;

export function youtubeCommentWorkPaneShouldChainScroll(
  pane: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">,
  deltaY: number,
): boolean {
  if (!deltaY) {
    return false;
  }
  if (pane.scrollHeight <= pane.clientHeight + YOUTUBE_COMMENT_WORK_PANE_SCROLL_EDGE_PX) {
    return true;
  }
  if (deltaY > 0) {
    return (
      pane.scrollTop + pane.clientHeight >=
      pane.scrollHeight - YOUTUBE_COMMENT_WORK_PANE_SCROLL_EDGE_PX
    );
  }
  return pane.scrollTop <= YOUTUBE_COMMENT_WORK_PANE_SCROLL_EDGE_PX;
}

export function youtubeCommentFindModalBody(
  start: HTMLElement | null,
): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node) {
    if (node.classList.contains("yt-modal-body")) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function youtubeCommentChainWorkPaneWheel(
  pane: HTMLElement,
  deltaY: number,
): boolean {
  if (!youtubeCommentWorkPaneShouldChainScroll(pane, deltaY)) {
    return false;
  }
  const outer = youtubeCommentFindModalBody(pane.parentElement);
  if (!outer) {
    console.warn("[YouTubeCommentWorkPane] Scroll chain skipped", {
      hasModalBody: false,
    });
    return false;
  }
  outer.scrollTop += deltaY;
  console.info("[YouTubeCommentWorkPane] Scroll chained", {
    direction: deltaY > 0 ? "down" : "up",
  });
  return true;
}
