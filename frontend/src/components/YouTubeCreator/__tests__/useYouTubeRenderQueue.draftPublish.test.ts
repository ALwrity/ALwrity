/**
 * TDD: library rescue must not put another video's combined file on a new draft.
 */
import { act, renderHook } from "@testing-library/react";
import type { Scene } from "../../../services/youtubeApi";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubeRenderQueue } from "../hooks/useYouTubeRenderQueue";

vi.mock("../../../services/youtubeApi", async () => {
  const actual = await vi.importActual<typeof import("../../../services/youtubeApi")>(
    "../../../services/youtubeApi",
  );
  return {
    ...actual,
    youtubeApi: {
      ...actual.youtubeApi,
      listVideos: vi.fn(),
    },
  };
});

const RESCUED_COMBINED = "/api/youtube/videos/combined_yesterday.mp4";
const LIBRARY_SCENE_1 = "/api/youtube/videos/scene_1_old.mp4";
const NEW_SCENE_1 = "/api/youtube/videos/scene_1_new.mp4";

const scene = (n: number, videoUrl?: string): Scene => ({
  scene_number: n,
  title: `Scene ${n}`,
  narration: "Narration",
  visual_prompt: "Visual",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  enabled: true,
  videoUrl,
});

const libraryWithOldCombined = {
  success: true,
  message: "ok",
  videos: [
    {
      scene_number: 1,
      video_url: LIBRARY_SCENE_1,
      filename: "scene_1_old.mp4",
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      scene_number: null,
      video_url: RESCUED_COMBINED,
      filename: "combined_yesterday.mp4",
      created_at: "2026-09-01T12:00:00Z",
      scene_count: 2,
    },
  ],
};

describe("useYouTubeRenderQueue this-draft combined URL", () => {
  beforeEach(() => {
    vi.mocked(youtubeApi.listVideos).mockReset();
  });

  it("does not restore account combined into finalVideoUrl for a new draft with no clips", async () => {
    let resolveList: (value: typeof libraryWithOldCombined) => void = () => undefined;
    vi.mocked(youtubeApi.listVideos).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useYouTubeRenderQueue({
        scenes: [scene(1), scene(2)],
        videoPlan: null,
        resolution: "720p",
        onScenesUpdate: vi.fn(),
      }),
    );

    expect(result.current.finalVideoUrl).toBeNull();

    await act(async () => {
      resolveList(libraryWithOldCombined);
    });

    expect(result.current.finalVideoUrl).toBeNull();
  });

  it("does not restore account combined after this draft generated only scene 1", async () => {
    let resolveList: (value: typeof libraryWithOldCombined) => void = () => undefined;
    vi.mocked(youtubeApi.listVideos).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useYouTubeRenderQueue({
        scenes: [scene(1, NEW_SCENE_1), scene(2)],
        videoPlan: null,
        resolution: "720p",
        onScenesUpdate: vi.fn(),
      }),
    );

    await act(async () => {
      resolveList(libraryWithOldCombined);
    });

    expect(result.current.finalVideoUrl).toBeNull();
  });
});
