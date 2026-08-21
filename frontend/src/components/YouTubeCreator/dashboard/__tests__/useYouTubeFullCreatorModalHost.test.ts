import { act, renderHook } from "@testing-library/react";
import { useYouTubeFullCreatorModalHost } from "../useYouTubeFullCreatorModalHost";
import {
  consumePendingOpenCreator,
  openYouTubeCreator,
  queueYouTubeCreatorOpen,
  YT_OPEN_CREATOR_EVENT,
} from "../youtubeStudioEvents";

describe("useYouTubeFullCreatorModalHost", () => {
  beforeEach(() => {
    sessionStorage.clear();
    consumePendingOpenCreator();
  });

  it("opens Full Creator modal when openYouTubeCreator fires", () => {
    const onCloseWedges = jest.fn();
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(onCloseWedges));

    expect(result.current.fullCreatorOpen).toBe(false);

    act(() => {
      openYouTubeCreator({ step: 0, durationType: "shorts" });
    });

    expect(onCloseWedges).toHaveBeenCalled();
    expect(result.current.fullCreatorOpen).toBe(true);
  });

  it("closes modal via closeFullCreatorModal", () => {
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(jest.fn()));

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
    const onCloseWedges = jest.fn();
    const { result } = renderHook(() => useYouTubeFullCreatorModalHost(onCloseWedges));

    expect(onCloseWedges).toHaveBeenCalled();
    expect(result.current.fullCreatorOpen).toBe(true);
  });
});
