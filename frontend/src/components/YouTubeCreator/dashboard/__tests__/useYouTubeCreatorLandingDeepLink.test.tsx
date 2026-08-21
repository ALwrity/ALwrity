import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useYouTubeCreatorLandingDeepLink } from "../useYouTubeCreatorLandingDeepLink";
import {
  consumePendingOpenCreator,
  hasPendingOpenCreator,
} from "../youtubeStudioEvents";

function wrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      children,
    );
  };
}

describe("useYouTubeCreatorLandingDeepLink", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("coerces ?tab=creator to Hub and queues Full Creator open", () => {
    const setTab = jest.fn();
    renderHook(() => useYouTubeCreatorLandingDeepLink(setTab), {
      wrapper: wrapper("/youtube-creator?tab=creator"),
    });

    expect(setTab).toHaveBeenCalledWith("hub");
    expect(hasPendingOpenCreator()).toBe(true);
    expect(consumePendingOpenCreator()).toEqual({ step: 0 });
  });

  it("does not queue when landing on Hub without creator tab", () => {
    const setTab = jest.fn();
    renderHook(() => useYouTubeCreatorLandingDeepLink(setTab), {
      wrapper: wrapper("/youtube-creator"),
    });

    expect(setTab).not.toHaveBeenCalled();
    expect(hasPendingOpenCreator()).toBe(false);
  });

  it("preserves existing pending prefill from Blog", () => {
    sessionStorage.setItem(
      "yt_pending_open_creator",
      JSON.stringify({ step: 0, userIdea: "Blog idea", focusUrlImport: true }),
    );
    const setTab = jest.fn();
    renderHook(() => useYouTubeCreatorLandingDeepLink(setTab), {
      wrapper: wrapper("/youtube-creator?tab=creator"),
    });

    expect(setTab).toHaveBeenCalledWith("hub");
    expect(consumePendingOpenCreator()).toEqual({
      step: 0,
      userIdea: "Blog idea",
      focusUrlImport: true,
    });
  });
});
