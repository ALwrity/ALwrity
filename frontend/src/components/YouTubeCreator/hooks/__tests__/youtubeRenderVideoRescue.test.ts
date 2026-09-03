/**
 * Combined-video draft rescue: pick the latest library item that is not a scene clip.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VideoListItem } from "../../../../services/youtubeApi";
import { pickYouTubeCombinedVideoUrl, mapYouTubeSceneVideosByNumber } from "../youtubeRenderVideoRescue";

const sceneClip = (n: number, createdAt: string): VideoListItem => ({
  scene_number: n,
  video_url: `/api/youtube/videos/scene_${n}.mp4`,
  filename: `scene_${n}.mp4`,
  created_at: createdAt,
  resolution: "720p",
});

const combinedClip = (
  filename: string,
  createdAt: string,
  sceneCount = 2,
): VideoListItem => ({
  scene_number: null,
  video_url: `/api/youtube/videos/${filename}`,
  filename,
  created_at: createdAt,
  resolution: "720p",
  scene_count: sceneCount,
});

describe("pickYouTubeCombinedVideoUrl", () => {
  it("returns null for an empty or missing list", () => {
    expect(pickYouTubeCombinedVideoUrl([])).toBeNull();
    expect(pickYouTubeCombinedVideoUrl(undefined)).toBeNull();
    expect(pickYouTubeCombinedVideoUrl(null)).toBeNull();
  });

  it("ignores scene clips even when they are newer", () => {
    const videos: VideoListItem[] = [
      sceneClip(2, "2026-09-01T12:00:00Z"),
      combinedClip("combined_old.mp4", "2026-08-01T12:00:00Z"),
      sceneClip(1, "2026-09-01T11:00:00Z"),
    ];
    expect(pickYouTubeCombinedVideoUrl(videos)).toBe(
      "/api/youtube/videos/combined_old.mp4",
    );
  });

  it("picks the most recent combined video by created_at", () => {
    const videos: VideoListItem[] = [
      combinedClip("combined_older.mp4", "2026-07-01T00:00:00Z"),
      sceneClip(1, "2026-09-01T00:00:00Z"),
      combinedClip("combined_newer.mp4", "2026-08-15T00:00:00Z"),
    ];
    expect(pickYouTubeCombinedVideoUrl(videos)).toBe(
      "/api/youtube/videos/combined_newer.mp4",
    );
  });

  it("treats a missing scene_number as combined (legacy library rows)", () => {
    const videos: VideoListItem[] = [
      {
        video_url: "/api/youtube/videos/combined_legacy.mp4",
        filename: "combined_legacy.mp4",
        created_at: "2026-08-01T00:00:00Z",
      },
      sceneClip(1, "2026-08-02T00:00:00Z"),
    ];
    expect(pickYouTubeCombinedVideoUrl(videos)).toBe(
      "/api/youtube/videos/combined_legacy.mp4",
    );
  });

  it("skips combined-looking rows with an empty video_url", () => {
    const videos: VideoListItem[] = [
      {
        scene_number: null,
        video_url: "",
        filename: "empty.mp4",
        scene_count: 2,
      },
      combinedClip("combined_ok.mp4", "2026-08-01T00:00:00Z"),
    ];
    expect(pickYouTubeCombinedVideoUrl(videos)).toBe(
      "/api/youtube/videos/combined_ok.mp4",
    );
  });

  it("returns null when the library only has scene clips", () => {
    expect(
      pickYouTubeCombinedVideoUrl([
        sceneClip(1, "2026-08-01T00:00:00Z"),
        sceneClip(2, "2026-08-02T00:00:00Z"),
      ]),
    ).toBeNull();
  });

  it("does not treat a single-scene row as combined", () => {
    expect(
      pickYouTubeCombinedVideoUrl([
        {
          scene_number: null,
          video_url: "/api/youtube/videos/one_scene.mp4",
          filename: "one_scene.mp4",
          scene_count: 1,
        },
        combinedClip("combined_ok.mp4", "2026-08-01T00:00:00Z"),
      ]),
    ).toBe("/api/youtube/videos/combined_ok.mp4");
  });

  it("skips invalid created_at when a dated combined row exists", () => {
    expect(
      pickYouTubeCombinedVideoUrl([
        {
          scene_number: null,
          video_url: "/api/youtube/videos/undated.mp4",
          filename: "undated.mp4",
          created_at: "not-a-date",
          scene_count: 2,
        },
        combinedClip("dated.mp4", "2026-08-01T00:00:00Z"),
      ]),
    ).toBe("/api/youtube/videos/dated.mp4");
  });
});

describe("mapYouTubeSceneVideosByNumber", () => {
  it("maps the first (most recent) clip per scene and ignores combined rows", () => {
    const mapped = mapYouTubeSceneVideosByNumber([
      sceneClip(1, "2026-09-01T12:00:00Z"),
      combinedClip("combined.mp4", "2026-09-01T13:00:00Z"),
      {
        scene_number: 1,
        video_url: "/api/youtube/videos/scene_1_older.mp4",
        filename: "scene_1_older.mp4",
        created_at: "2026-08-01T12:00:00Z",
      },
    ]);
    expect(mapped.get(1)).toBe("/api/youtube/videos/scene_1.mp4");
    expect(mapped.size).toBe(1);
  });

  it("returns an empty map for missing lists", () => {
    expect(mapYouTubeSceneVideosByNumber(undefined).size).toBe(0);
    expect(mapYouTubeSceneVideosByNumber([]).size).toBe(0);
  });
});

describe("useYouTubeRenderQueue combined rescue contract", () => {
  it("rescues scene clips from listVideos and does not restore account combined", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(dir, "..", "useYouTubeRenderQueue.ts"),
      "utf8",
    );
    expect(source).not.toContain("pickYouTubeCombinedVideoUrl");
    expect(source).toContain("mapYouTubeSceneVideosByNumber");
    expect(source).toContain("listVideos");
    expect(source).toContain("setFinalVideoUrl");
    expect(source).toContain("combinedFromThisSession");
  });
});
