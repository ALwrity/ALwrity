/**
 * Loader copy for YouTube pitch generation on Plan Your Video.
 * Mirrors brainstorm rotating messages and podcast script-gen step progress.
 */

export const PLAN_GENERATION_LOADER_INTERVAL_MS = 4000;

const BASE_MESSAGES = [
  "Loading Channel Bible and persona defaults...",
  "Building the pitch prompt from your form...",
  "Asking the shared text LLM (llm_text_gen) for your pitch...",
  "Checking title, summary, hook, and beats...",
] as const;

const RESEARCH_MESSAGES = [
  "Loading Channel Bible and persona defaults...",
  "Searching the web via Exa for current angles...",
  "Injecting research into the pitch prompt...",
  "Asking the shared text LLM (llm_text_gen) for your pitch...",
  "Checking title, summary, hook, and beats...",
] as const;

const BASE_STEPS = [
  "Apply Channel Bible and persona",
  "Build the pitch prompt",
  "Generate the pitch with llm_text_gen",
  "Validate title, summary, and beats",
];

const RESEARCH_STEPS = [
  "Apply Channel Bible and persona",
  "Search the web via Exa",
  "Inject research into the prompt",
  "Generate the pitch with llm_text_gen",
  "Validate title, summary, and beats",
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
