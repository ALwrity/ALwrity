import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { YouTubeLlmPromptMeta } from "./YouTubeLlmPromptMeta";

describe("YouTubeLlmPromptMeta", () => {
  it("renders the exact system and user prompts under a custom heading", () => {
    render(
      <YouTubeLlmPromptMeta
        heading="Exact pitch prompt sent to the LLM"
        generation={{
          text_gateway: "llm_text_gen",
          system_prompt: "You are ALwrity Pitch.",
          user_prompt: "Generate a pitch for weekend packing.",
          json_schema_applied: true,
        }}
      />,
    );

    expect(screen.getByText("Exact pitch prompt sent to the LLM")).toBeInTheDocument();
    expect(screen.getByText("You are ALwrity Pitch.")).toBeInTheDocument();
    expect(screen.getByText("Generate a pitch for weekend packing.")).toBeInTheDocument();
  });

  it("renders nothing when generation metadata is missing", () => {
    const { container } = render(
      <YouTubeLlmPromptMeta heading="Exact pitch prompt sent to the LLM" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
