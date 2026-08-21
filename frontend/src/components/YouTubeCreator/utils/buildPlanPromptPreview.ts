/**
 * Client-side plan prompt template for the Plan step.
 * Does not fetch Exa. Persona extras are added on the server at generate time.
 */

import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { buildChannelBibleContext } from "./channelBibleContext";

/** Matches backend PLANNER_SYSTEM_PROMPT in planner_prompts.py */
export const PLANNER_SYSTEM_PROMPT_PREVIEW = `You are an expert YouTube content strategist and video producer. You write clear, specific, shootable video plans. The end user never writes a prompt: ALwrity puts their form fields (idea, video type, duration, audience, goal, style, tone, language, constraints, channel bible, persona, and research) into the user message.

TASK: Create one YouTube video plan for the idea in the user message. These plans are used to generate actual video content.

CRITICAL RULES:
- Treat the user message as the source of truth for this episode.
- Use these fields as-is when they are present: video idea, video type/format, duration (including hook/main/CTA seconds and max scenes), audience, goal, style, tone, language, constraints, channel bible, persona, and research.
- Do not invent a different audience, goal, style, tone, language, or duration than the user message specifies.
- If a Video Type block is present, follow its structure, hook, visual, tone, and CTA guidance.
- Content outline duration_estimate values must sum to the stated target duration (±20%).
- Ground every section in the video idea. If research is present, use it only as facts and angles for this topic; do not ignore the idea or invent statistics that are not in the research.
- Reply with the JSON object specified in the user message (same field names). Do not add commentary outside JSON.
`;

export const EXA_RESEARCH_PLACEHOLDER = "{{EXA_RESEARCH}}";

export interface PlanPromptPreviewInput {
  userIdea: string;
  durationType: string;
  videoType?: string;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  language?: string;
  enableResearch: boolean;
  channelBible?: YouTubeChannelBible | null;
}

export function buildPlanPromptPreview(input: PlanPromptPreviewInput): {
  systemPrompt: string;
  userPromptTemplate: string;
} {
  const idea = (input.userIdea || "").trim() || "(enter your video idea)";
  const duration = input.durationType || "medium";
  const videoType = (input.videoType || "").trim() || "General";
  const audience = (input.targetAudience || "").trim() || "(inferred on the server if empty)";
  const goal = (input.videoGoal || "").trim() || "(inferred on the server if empty)";
  const style = (input.brandStyle || "").trim() || "(default visual style on the server)";
  const bible = (() => {
    try {
      return buildChannelBibleContext(input.channelBible);
    } catch (error) {
      console.error("[buildPlanPromptPreview] Channel Bible context failed", error);
      return "";
    }
  })();

  const researchBlock = input.enableResearch
    ? `${EXA_RESEARCH_PLACEHOLDER}\nLive web research (up to 2000 characters plus the top 5 sources) is appended here when you generate. It is not fetched until you click Generate Video Plan.`
    : "Web research is off. No Exa block will be added to the prompt.";

  const userPromptTemplate = [
    `Create a YouTube video plan for: "${idea}"`,
    "",
    `**Video Format:** ${videoType} | **Duration:** ${duration}`,
    `**Audience:** ${audience}`,
    `**Goal:** ${goal}`,
    `**Style:** ${style}`,
    input.language ? `**Language:** ${input.language}` : "",
    "",
    bible ? `${bible}\n` : "(Channel Bible is added on the server when saved.)",
    "",
    "(YouTube persona, if you have one, is added on the server.)",
    "",
    researchBlock,
    "",
    "Structured JSON schema is applied at generate time (not shown here).",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    systemPrompt: PLANNER_SYSTEM_PROMPT_PREVIEW,
    userPromptTemplate,
  };
}
