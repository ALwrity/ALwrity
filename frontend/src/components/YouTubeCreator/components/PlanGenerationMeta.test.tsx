import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { PlanGenerationMeta } from "./PlanGenerationMeta";
import type { VideoPlan } from "../../../services/youtubeApi";

const plan: VideoPlan = {
  video_summary: "Summary",
  target_audience: "Viewers",
  content_outline: [],
  hook_strategy: "Hook",
  visual_style: "Clean",
  seo_keywords: [],
  duration_type: "shorts",
  research_enabled: true,
  research_sources: [{ title: "Travel Guide", url: "https://example.com/travel" }],
  generation: {
    text_gateway: "llm_text_gen",
    configured_provider: "wavespeed",
    system_prompt: "You are an expert YouTube content strategist.",
    user_prompt: "**Research & Current Information:**\nTrend X",
    research_enabled: true,
    research_injected: true,
    json_schema_applied: true,
  },
};

describe("PlanGenerationMeta", () => {
  it("shows exact prompt and research source", () => {
    render(<PlanGenerationMeta plan={plan} />);

    expect(screen.getByText("Exact prompt sent to the LLM")).toBeInTheDocument();
    expect(screen.getByText(/Trend X/)).toBeInTheDocument();
    expect(screen.getByText("Travel Guide")).toBeInTheDocument();
    expect(screen.getByText(/Research injected/)).toBeInTheDocument();
    expect(screen.getByText(/Gateway: llm_text_gen/)).toBeInTheDocument();
  });

  it("uses a custom heading when provided", () => {
    render(<PlanGenerationMeta plan={plan} heading="Exact pitch prompt sent to the LLM" />);
    expect(screen.getByText("Exact pitch prompt sent to the LLM")).toBeInTheDocument();
  });
});
