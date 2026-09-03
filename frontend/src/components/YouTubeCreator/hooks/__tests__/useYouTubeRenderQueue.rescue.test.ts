/**
 * Render-queue mount rescue: scene clips and combined video from listVideos().
 */
import { renderHook, waitFor } from "@testing-library/react";
import type { Scene } from "../../../../services/youtubeApi";
import { youtubeApi } from "../../../../services/youtubeApi";
import { useYouTubeRenderQueue } from "../useYouTubeRenderQueue";

vi.mock("../../../../services/youtubeApi", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/youtubeApi")>(
    "../../../../services/youtubeApi",
  );
  return {
    ...actual,
    youtubeApi: {
      ...actual.youtubeApi,
      listVideos: vi.fn(),
    },
  };
});

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

function renderQueue(scenes: Scene[], onScenesUpdate = vi.fn()) {
  return renderHook(() =>
    useYouTubeRenderQueue({
      scenes,
      videoPlan: null,
      resolution: "720p",
      onScenesUpdate,
    }),
  );
}

describe("useYouTubeRenderQueue library rescue", () => {
  beforeEach(() => {
    vi.mocked(youtubeApi.listVideos).mockReset();
  });

  it("does not restore account combined into finalVideoUrl on mount", async () => {
    vi.mocked(youtubeApi.listVideos).mockResolvedValue({
      success: true,
      message: "ok",
      videos: [
        {
          scene_number: 1,
          video_url: "/api/youtube/videos/scene_1.mp4",
          filename: "scene_1.mp4",
          created_at: "2026-09-01T10:00:00Z",
        },
        {
          scene_number: null,
          video_url: "/api/youtube/videos/combined_latest.mp4",
          filename: "combined_latest.mp4",
          created_at: "2026-09-01T12:00:00Z",
          scene_count: 2,
        },
        {
          scene_number: null,
          video_url: "/api/youtube/videos/combined_older.mp4",
          filename: "combined_older.mp4",
          created_at: "2026-08-01T12:00:00Z",
          scene_count: 2,
        },
      ],
    });

    const { result } = renderQueue([scene(1), scene(2)]);

    await waitFor(() => {
      expect(youtubeApi.listVideos).toHaveBeenCalled();
    });
    expect(result.current.finalVideoUrl).toBeNull();
    expect(result.current.combinedFromThisSession).toBe(false);
  });

  it("still restores scene clip URLs and does not treat combined as a scene", async () => {
    const onScenesUpdate = vi.fn();
    vi.mocked(youtubeApi.listVideos).mockResolvedValue({
      success: true,
      message: "ok",
      videos: [
        {
          scene_number: 1,
          video_url: "/api/youtube/videos/scene_1.mp4",
          filename: "scene_1.mp4",
          created_at: "2026-09-01T10:00:00Z",
        },
        {
          scene_number: null,
          video_url: "/api/youtube/videos/combined.mp4",
          filename: "combined.mp4",
          created_at: "2026-09-01T12:00:00Z",
          scene_count: 2,
        },
      ],
    });

    const { result } = renderQueue([scene(1), scene(2)], onScenesUpdate);

    await waitFor(() => {
      expect(onScenesUpdate).toHaveBeenCalled();
    });

    const updated = onScenesUpdate.mock.calls[0][0] as Scene[];
    expect(updated[0].videoUrl).toBe("/api/youtube/videos/scene_1.mp4");
    expect(updated[1].videoUrl).toBeUndefined();
    expect(result.current.finalVideoUrl).toBeNull();
    expect(result.current.combinedFromThisSession).toBe(false);
  });

  it("leaves finalVideoUrl null when the library only has scene clips", async () => {
    vi.mocked(youtubeApi.listVideos).mockResolvedValue({
      success: true,
      message: "ok",
      videos: [
        {
          scene_number: 1,
          video_url: "/api/youtube/videos/scene_1.mp4",
          filename: "scene_1.mp4",
          created_at: "2026-09-01T10:00:00Z",
        },
      ],
    });

    const { result } = renderQueue([scene(1)]);

    await waitFor(() => {
      expect(youtubeApi.listVideos).toHaveBeenCalled();
    });
    expect(result.current.finalVideoUrl).toBeNull();
  });

  it("leaves draft state unchanged when listVideos fails", async () => {
    const onScenesUpdate = vi.fn();
    vi.mocked(youtubeApi.listVideos).mockRejectedValue(new Error("network down"));

    const { result } = renderQueue([scene(1)], onScenesUpdate);

    await waitFor(() => {
      expect(youtubeApi.listVideos).toHaveBeenCalled();
    });

    expect(result.current.finalVideoUrl).toBeNull();
    expect(onScenesUpdate).not.toHaveBeenCalled();
  });
});
