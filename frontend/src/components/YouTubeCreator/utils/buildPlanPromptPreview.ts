/**
 * Client-side plan prompt template for the Plan step.
 * Does not fetch Exa. Persona extras are added on the server at generate time.
 */

import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { buildChannelBibleContext } from "./channelBibleContext";

/** Matches backend PLANNER_SYSTEM_PROMPT in planner_prompts.py */
export const PLANNER_SYSTEM_PROMPT_PREVIEW =
  "You are an expert YouTube content strategist. Create clear, actionable video plans " +
  "that are optimized for the specified video type and audience. Focus on accuracy and " +
  "specificity - these plans will be used to generate actual video content.";

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
