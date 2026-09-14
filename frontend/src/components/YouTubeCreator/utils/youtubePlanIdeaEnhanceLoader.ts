/**
 * Loader copy for Enhance Topic with AI on Plan Your Video.
 */

export const YOUTUBE_PLAN_IDEA_ENHANCE_MESSAGES = [
  "Loading Channel Bible context...",
  "Building three distinct topic angles from your idea...",
  "Asking the shared text LLM (llm_text_gen) for options...",
  "Checking that exactly three topics came back...",
] as const;

export const YOUTUBE_PLAN_IDEA_ENHANCE_STEPS = [
  "Apply Channel Bible context",
  "Build the enhance prompt",
  "Generate three topics with llm_text_gen",
  "Validate three topic choices",
];

export function getYouTubePlanIdeaEnhanceLoaderCopy(): {
  messages: readonly string[];
  steps: string[];
} {
  return {
    messages: YOUTUBE_PLAN_IDEA_ENHANCE_MESSAGES,
    steps: [...YOUTUBE_PLAN_IDEA_ENHANCE_STEPS],
  };
}
