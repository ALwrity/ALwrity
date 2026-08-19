/**
 * Loader copy for YouTube "Build Scenes from Plan".
 * Mirrors plan-generation rotating messages. Steps match scene_builder:
 * outline → llm_text_gen scenes → normalize → visual prompt enhance.
 */

export const SCENE_BUILD_LOADER_MESSAGES = [
  "Reading your plan outline, hook, and CTA...",
  "Asking the shared text LLM (llm_text_gen) for scene scripts...",
  "Normalizing narration, visuals, and timing...",
  "Enhancing visual prompts for each scene...",
] as const;

export const SCENE_BUILD_LOADER_STEPS = [
  "Read plan outline, hook, and CTA",
  "Generate scenes with llm_text_gen",
  "Normalize narration, visuals, and timing",
  "Enhance visual prompts",
];

export function getSceneBuildLoaderCopy(): {
  messages: readonly string[];
  steps: string[];
} {
  return {
    messages: SCENE_BUILD_LOADER_MESSAGES,
    steps: [...SCENE_BUILD_LOADER_STEPS],
  };
}
