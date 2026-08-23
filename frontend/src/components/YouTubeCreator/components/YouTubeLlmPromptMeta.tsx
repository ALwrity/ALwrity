/**
 * YouTube pitch/expand: reuse PlanGenerationMeta with a stub plan.
 * Display only — does not change LLM calls.
 */

import React, { useMemo } from "react";
import type {
  VideoPlan,
  VideoPlanGeneration,
  VideoPlanResearchSource,
} from "../../../services/youtubeApi";
import { PlanGenerationMeta } from "./PlanGenerationMeta";

interface YouTubeLlmPromptMetaProps {
  heading: string;
  generation?: VideoPlanGeneration;
  researchEnabled?: boolean;
  researchSources?: VideoPlanResearchSource[];
}

export const YouTubeLlmPromptMeta: React.FC<YouTubeLlmPromptMetaProps> = ({
  heading,
  generation,
  researchEnabled,
  researchSources,
}) => {
  const plan: VideoPlan = useMemo(
    () => ({
      video_summary: "",
      target_audience: "",
      content_outline: [],
      hook_strategy: "",
      visual_style: "",
      seo_keywords: [],
      duration_type: "medium",
      generation,
      research_enabled: researchEnabled,
      research_sources: researchSources,
    }),
    [generation, researchEnabled, researchSources],
  );

  if (!generation && !(researchSources?.length) && researchEnabled == null) {
    return null;
  }

  try {
    console.info("[YouTubeLlmPromptMeta] Rendering LLM prompt accordion", {
      heading,
      hasSystem: Boolean(generation?.system_prompt),
      systemLen: generation?.system_prompt?.length ?? 0,
      userLen: generation?.user_prompt?.length ?? 0,
      sourcesCount: researchSources?.length ?? 0,
    });
  } catch {
    // Logging must not affect the pitch/expand UI.
  }

  return <PlanGenerationMeta plan={plan} heading={heading} />;
};
