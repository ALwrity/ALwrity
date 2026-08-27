import { buildYoutubeSceneVideoPromptPreview, resolveYoutubeSceneVideoDuration } from "./buildYoutubeSceneVideoPromptPreview";

describe("buildYoutubeSceneVideoPromptPreview", () => {
  it("prefers enhanced visual prompt and i2v when image exists", () => {
    const preview = buildYoutubeSceneVideoPromptPreview({
      visual_prompt: "Original",
      enhanced_visual_prompt: "Enhanced cinematic shot",
      duration_estimate: 5,
      imageUrl: "/api/youtube/images/scenes/s1.png",
    });

    expect(preview.visualPrompt).toBe("Enhanced cinematic shot");
    expect(preview.promptSource).toBe("enhanced_visual_prompt");
    expect(preview.generationMode).toBe("i2v");
    expect(preview.duration).toBe(5);
    expect(preview.imageAttached).toBe(true);
    expect(preview.hasSystemPrompt).toBe(false);
    expect(preview.imageUrl).toBe("/api/youtube/images/scenes/s1.png");
  });

  it("uses 10s clip for longer scenes", () => {
    const preview = buildYoutubeSceneVideoPromptPreview({
      visual_prompt: "Studio shot",
      duration_estimate: 9,
    });

    expect(preview.duration).toBe(10);
    expect(preview.generationMode).toBe("t2v");
    expect(preview.imageAttached).toBe(false);
    expect(preview.audioAttached).toBe(false);
  });

  it("resolveYoutubeSceneVideoDuration matches WAN 5s or 10s", () => {
    expect(resolveYoutubeSceneVideoDuration(5)).toBe(5);
    expect(resolveYoutubeSceneVideoDuration(8)).toBe(10);
    expect(resolveYoutubeSceneVideoDuration(undefined)).toBe(5);
  });

  it("records attached audio path without query tokens", () => {
    const preview = buildYoutubeSceneVideoPromptPreview({
      visual_prompt: "Studio shot",
      duration_estimate: 5,
      audioUrl: "/api/youtube/audio/scenes/s1.mp3?token=secret",
    });

    expect(preview.audioAttached).toBe(true);
    expect(preview.audioUrl).toBe("/api/youtube/audio/scenes/s1.mp3");
    expect(preview.audioNote).toContain("first 5s or 10s");
  });
});
