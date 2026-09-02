/**
 * TDD: publish only a video that belongs to this draft.
 * Production helper will live at components/youtubeDraftPublishVideo.ts.
 *
 * Do not publish account-rescued combined files or leftover renderStatus URLs.
 * One ready clip → that clip. Two+ ready clips without this-session Combine → disable.
 */
import type { Scene } from "../../../services/youtubeApi";
import { selectYouTubeDraftPublishVideo, youtubeDraftPublishLogMeta } from "../components/youtubeDraftPublishVideo";

const RESCUED_COMBINED = "/api/youtube/videos/combined_yesterday.mp4";
const SESSION_COMBINED = "/api/youtube/videos/combined_this_session.mp4";
const LEFTOVER_RENDER = "/api/youtube/videos/old_batch_final.mp4";
const SCENE_1 = "/api/youtube/videos/scene_1_new.mp4";
const SCENE_2 = "/api/youtube/videos/scene_2_new.mp4";

const clip = (n: number, url?: string, enabled = true): Scene => ({
  scene_number: n,
  title: `Scene ${n}`,
  narration: "Narration",
  visual_prompt: "Visual",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  enabled,
  videoUrl: url,
});

describe("selectYouTubeDraftPublishVideo", () => {
  it("publishes the single ready scene clip and ignores rescued combined and leftover render URLs", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, SCENE_1), clip(2)],
      }),
    ).toEqual({
      url: SCENE_1,
      source: "scene_clip",
      publishEnabled: true,
      publishLine: "Publishing: scene 1 clip",
      helperText: null,
    });
  });

  it("uses the scene number of the ready clip, not always scene 1", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: null,
        scenes: [clip(1), clip(2, SCENE_2)],
      }).publishLine,
    ).toBe("Publishing: scene 2 clip");
  });

  it("skips disabled scenes when counting ready clips", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, SCENE_1, false), clip(2, SCENE_2)],
      }),
    ).toEqual({
      url: SCENE_2,
      source: "scene_clip",
      publishEnabled: true,
      publishLine: "Publishing: scene 2 clip",
      helperText: null,
    });
  });

  it("disables publish when two or more ready clips exist and Combine has not run this session", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
      }),
    ).toEqual({
      url: null,
      source: "none",
      publishEnabled: false,
      publishLine: null,
      helperText: "Combine these scenes first.",
    });
  });

  it("publishes this-session combined output when the user has Combined", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: SESSION_COMBINED,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
      }),
    ).toEqual({
      url: SESSION_COMBINED,
      source: "combined",
      publishEnabled: true,
      publishLine: "Publishing: combined video",
      helperText: null,
    });
  });

  it("does not publish rescued combined or leftover render URLs when this draft has no clip", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1), clip(2)],
      }),
    ).toEqual({
      url: null,
      source: "none",
      publishEnabled: false,
      publishLine: null,
      helperText: null,
    });
  });

  it("never puts a video URL or filename into publishLine or helperText", () => {
    const oneClip = selectYouTubeDraftPublishVideo({
      sessionCombinedUrl: null,
      rescuedCombinedUrl: RESCUED_COMBINED,
      leftoverRenderUrl: LEFTOVER_RENDER,
      scenes: [clip(1, SCENE_1)],
    });
    const combined = selectYouTubeDraftPublishVideo({
      sessionCombinedUrl: SESSION_COMBINED,
      rescuedCombinedUrl: RESCUED_COMBINED,
      leftoverRenderUrl: null,
      scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
    });

    for (const decision of [oneClip, combined]) {
      expect(decision.publishLine ?? "").not.toMatch(/\/api\/youtube|\.mp4/i);
      expect(decision.helperText ?? "").not.toMatch(/\/api\/youtube|\.mp4/i);
      expect(decision.publishLine).not.toContain(SCENE_1);
      expect(decision.publishLine).not.toContain(SESSION_COMBINED);
    }
  });

  it("returns none for missing scenes instead of inventing a URL", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: null,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: null,
      }),
    ).toEqual({
      url: null,
      source: "none",
      publishEnabled: false,
      publishLine: null,
      helperText: null,
    });
  });

  it("ignores blank or whitespace-only session combined and scene URLs", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: "   ",
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, "  "), clip(2, ` ${SCENE_1} `)],
      }),
    ).toEqual({
      url: SCENE_1,
      source: "scene_clip",
      publishEnabled: true,
      publishLine: "Publishing: scene 2 clip",
      helperText: null,
    });
  });

  it("prefers this-session combined over a single ready clip", () => {
    expect(
      selectYouTubeDraftPublishVideo({
        sessionCombinedUrl: SESSION_COMBINED,
        rescuedCombinedUrl: RESCUED_COMBINED,
        leftoverRenderUrl: LEFTOVER_RENDER,
        scenes: [clip(1, SCENE_1)],
      }).source,
    ).toBe("combined");
  });

  it("returns none when selection cannot read the input instead of inventing a URL", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      selectYouTubeDraftPublishVideo(undefined as unknown as Parameters<
        typeof selectYouTubeDraftPublishVideo
      >[0]),
    ).toEqual({
      url: null,
      source: "none",
      publishEnabled: false,
      publishLine: null,
      helperText: null,
    });
    expect(error).toHaveBeenCalled();
    const payload = JSON.stringify(error.mock.calls);
    expect(payload).not.toContain("/api/youtube");
    error.mockRestore();
  });

  it("does not log video URLs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    selectYouTubeDraftPublishVideo({
      sessionCombinedUrl: SESSION_COMBINED,
      rescuedCombinedUrl: RESCUED_COMBINED,
      leftoverRenderUrl: LEFTOVER_RENDER,
      scenes: [clip(1, SCENE_1)],
    });
    const payloads = [...info.mock.calls, ...error.mock.calls].map((call) =>
      JSON.stringify(call),
    );
    for (const payload of payloads) {
      expect(payload).not.toContain(SCENE_1);
      expect(payload).not.toContain(SESSION_COMBINED);
      expect(payload).not.toContain(RESCUED_COMBINED);
      expect(payload).not.toContain(LEFTOVER_RENDER);
    }
    info.mockRestore();
    error.mockRestore();
  });

  it("logs source kind and flags without the video URL", () => {
    const decision = selectYouTubeDraftPublishVideo({
      sessionCombinedUrl: SESSION_COMBINED,
      scenes: [clip(1, SCENE_1)],
    });
    const meta = youtubeDraftPublishLogMeta(decision, {
      combinedFromThisSession: true,
      hasRescuedCombined: true,
      hasLeftoverRender: true,
    });
    expect(meta.publishVideoSource).toBe("combined");
    expect(meta.ignoredRescuedCombined).toBe(true);
    expect(JSON.stringify(meta)).not.toContain(SESSION_COMBINED);
    expect(JSON.stringify(meta)).not.toContain(SCENE_1);
  });
});
