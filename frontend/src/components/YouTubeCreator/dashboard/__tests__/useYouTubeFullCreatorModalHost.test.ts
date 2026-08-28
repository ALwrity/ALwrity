import { act, renderHook } from "@testing-library/react";
import { useYouTubeFullCreatorModalHost } from "../useYouTubeFullCreatorModalHost";
import {
  consumePendingOpenCreator,
  openYouTubeCreator,
  queueYouTubeCreatorOpen,
  YT_CLOSE_CREATOR_EVENT,
  YT_OPEN_CREATOR_EVENT,
} from "../youtubeStudioEvents";

describe("useYouTubeFullCreatorModalHost", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("opens Full Creator modal when openYouTubeCreator fires", () => {
    const onCloseWedges = vi.fn();
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(onCloseWedges));

    expect(result.current.fullCreatorOpen).toBe(false);

    act(() => {
      openYouTubeCreator({ step: 0, durationType: "shorts" });
    });

    expect(onCloseWedges).toHaveBeenCalled();
    expect(result.current.fullCreatorOpen).toBe(true);
  });

  it("closes modal via closeFullCreatorModal", () => {
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(vi.fn()));

    act(() => {
      window.dispatchEvent(new CustomEvent(YT_OPEN_CREATOR_EVENT, { detail: {} }));
    });
    expect(result.current.fullCreatorOpen).toBe(true);

    act(() => {
      result.current.closeFullCreatorModal();
    });
    expect(result.current.fullCreatorOpen).toBe(false);
  });

  it("opens Full Creator modal when pending deep-link exists on mount", () => {
    queueYouTubeCreatorOpen({ step: 0, userIdea: "From blog" });
    const onCloseWedges = vi.fn();
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(onCloseWedges));

    expect(onCloseWedges).toHaveBeenCalled();
    expect(result.current.fullCreatorOpen).toBe(true);
  });

  it("retargets legacy discovery pending to Plan wedge instead of opening Creator", () => {
    queueYouTubeCreatorOpen({
      step: 0,
      userIdea: "Blog idea",
      focusUrlImport: true,
    });
    const onCloseWedges = vi.fn();
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(onCloseWedges));

    expect(onCloseWedges).not.toHaveBeenCalled();
    expect(result.current.fullCreatorOpen).toBe(false);
    expect(consumePendingOpenCreator()).toBeNull();
  });

  it("closes modal and clears pending on YT_CLOSE_CREATOR_EVENT", () => {
    queueYouTubeCreatorOpen({ step: 0, userIdea: "Queued" });
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(vi.fn()));

    act(() => {
      window.dispatchEvent(new CustomEvent(YT_OPEN_CREATOR_EVENT, { detail: {} }));
    });
    expect(result.current.fullCreatorOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent(YT_CLOSE_CREATOR_EVENT));
    });

    expect(result.current.fullCreatorOpen).toBe(false);
    expect(consumePendingOpenCreator()).toBeNull();
  });
});
