/**
 * Loader copy for YouTube video plan generation.
 * Mirrors brainstorm rotating messages and podcast script-gen step progress.
 * Steps match the real planner pipeline (bible/persona → optional Exa → llm_text_gen).
 */

export const PLAN_GENERATION_LOADER_INTERVAL_MS = 4000;

const BASE_MESSAGES = [
  "Loading Channel Bible and persona defaults...",
  "Building the planning prompt from your form...",
  "Asking the shared text LLM (llm_text_gen) for your plan...",
  "Checking outline timing, titles, and SEO keywords...",
] as const;

const RESEARCH_MESSAGES = [
  "Loading Channel Bible and persona defaults...",
  "Searching the web via Exa for current angles...",
  "Injecting research into the planning prompt...",
  "Asking the shared text LLM (llm_text_gen) for your plan...",
  "Checking outline timing, titles, and SEO keywords...",
] as const;

const BASE_STEPS = [
  "Apply Channel Bible and persona",
  "Build the plan prompt",
  "Generate the plan with llm_text_gen",
  "Validate outline, titles, and keywords",
];

const RESEARCH_STEPS = [
  "Apply Channel Bible and persona",
  "Search the web via Exa",
  "Inject research into the prompt",
  "Generate the plan with llm_text_gen",
  "Validate outline, titles, and keywords",
];

export function getPlanGenerationLoaderCopy(enableResearch: boolean): {
  messages: readonly string[];
  steps: string[];
} {
  if (enableResearch) {
    return { messages: RESEARCH_MESSAGES, steps: [...RESEARCH_STEPS] };
  }
  return { messages: BASE_MESSAGES, steps: [...BASE_STEPS] };
}

export function planGenerationProgressPercent(
  loaderMessageIndex: number,
  messageCount: number,
): number {
  const count = Math.max(1, messageCount);
  const index = Math.min(Math.max(0, loaderMessageIndex), count - 1);
  return Math.min(95, ((index + 1) / count) * 100);
}
