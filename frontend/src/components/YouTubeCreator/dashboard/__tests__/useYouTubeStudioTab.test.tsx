import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useYouTubeStudioTab } from "../useYouTubeStudioTab";
import {
  consumePendingOpenCreator,
  hasPendingOpenCreator,
  YT_SWITCH_TAB_EVENT,
} from "../youtubeStudioEvents";

function wrapper(initialEntry = "/youtube-creator") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      children,
    );
  };
}

describe("useYouTubeStudioTab — Hub-only", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("reports hub for any URL tab query", () => {
    const { result } = renderHook(() => useYouTubeStudioTab(), {
      wrapper: wrapper("/youtube-creator?tab=creator"),
    });
    expect(result.current.tab).toBe("hub");
  });

  it("maps setTab(creator) to Full Creator open and keeps hub URL", () => {
    const { result } = renderHook(() => useYouTubeStudioTab(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.setTab("creator");
    });

    expect(hasPendingOpenCreator()).toBe(true);
    expect(result.current.tab).toBe("hub");
  });

  it("maps switchTab(creator) event to Full Creator open", () => {
    renderHook(() => useYouTubeStudioTab(), { wrapper: wrapper() });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(YT_SWITCH_TAB_EVENT, { detail: { tab: "creator" } }),
      );
    });

    expect(hasPendingOpenCreator()).toBe(true);
  });
});
