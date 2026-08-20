/**
 * Client-side YouTube scene image prompt preview (mirrors youtube_scene_image_prompts.py).
 */

export interface YoutubeSceneImagePromptPreviewInput {
  sceneTitle?: string;
  sceneContent?: string;
  idea?: string;
  customPrompt?: string;
  hasBaseAvatar?: boolean;
}

export function buildYoutubeSceneImagePromptPreview(
  input: YoutubeSceneImagePromptPreviewInput,
): {
  imagePrompt: string;
  templatePrompt: string;
  generationType: "character" | "scene";
  customPromptUsed: boolean;
} {
  const sceneTitle = input.sceneTitle || "";
  const sceneContent = input.sceneContent || "";
  const idea = input.idea || "";
  const customPrompt = (input.customPrompt || "").trim();
  const hasBaseAvatar = Boolean(input.hasBaseAvatar);

  if (hasBaseAvatar) {
    const promptParts: string[] = [];
    if (sceneTitle) promptParts.push(`Scene: ${sceneTitle}`);
    if (sceneContent) {
      promptParts.push(`Context: ${sceneContent.slice(0, 200).replace(/\n/g, " ").trim()}`);
    }
    if (idea) promptParts.push(`Video idea: ${idea.slice(0, 80).trim()}`);
    promptParts.push("YouTube creator on camera, engaging and dynamic framing");
    promptParts.push("Clean background, good lighting, thumbnail-friendly composition");
    const templatePrompt = promptParts.join(", ");
    return {
      imagePrompt: templatePrompt,
      templatePrompt,
      generationType: "character",
      customPromptUsed: false,
    };
  }

  const promptParts = [
    "YouTube creator scene",
    "clean, modern background",
    "good lighting, high contrast for thumbnail clarity",
  ];
  if (sceneTitle) promptParts.push(`Scene theme: ${sceneTitle}`);
  if (sceneContent) {
    promptParts.push(`Context: ${sceneContent.slice(0, 120).replace(/\n/g, " ")}`);
  }
  if (idea) promptParts.push(`Topic: ${idea.slice(0, 80)}`);
  promptParts.push("video-optimized composition, 16:9 aspect ratio");
  const templatePrompt = promptParts.join(", ");
  const customPromptUsed = Boolean(customPrompt);
  return {
    imagePrompt: customPrompt || templatePrompt,
    templatePrompt,
    generationType: "scene",
    customPromptUsed,
  };
}
