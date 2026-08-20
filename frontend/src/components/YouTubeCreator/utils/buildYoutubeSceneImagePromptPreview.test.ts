import { buildYoutubeSceneImagePromptPreview } from "./buildYoutubeSceneImagePromptPreview";

describe("buildYoutubeSceneImagePromptPreview", () => {
  it("uses custom prompt in scene mode", () => {
    const preview = buildYoutubeSceneImagePromptPreview({
      sceneTitle: "Hook",
      sceneContent: "Open strong",
      customPrompt: "Custom prompt text",
      hasBaseAvatar: false,
    });

    expect(preview.imagePrompt).toBe("Custom prompt text");
    expect(preview.customPromptUsed).toBe(true);
  });
});
