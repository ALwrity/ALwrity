import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { YouTubeSceneAssetPromptMeta } from "./YouTubeSceneAssetPromptMeta";

describe("YouTubeSceneAssetPromptMeta", () => {
  it("shows image prompt metadata", () => {
    render(
      <YouTubeSceneAssetPromptMeta
        kind="image"
        imageGeneration={{
          image_prompt: "YouTube creator scene, Scene theme: Hook",
          provider: "wavespeed",
          model: "ideogram-v3-turbo",
          generation_type: "scene",
        }}
        defaultExpanded
      />,
    );

    expect(screen.getByText("Exact prompt sent for scene image")).toBeInTheDocument();
    expect(screen.getByText(/Scene theme: Hook/)).toBeInTheDocument();
  });

  it("shows audio speech text metadata", () => {
    render(
      <YouTubeSceneAssetPromptMeta
        kind="audio"
        audioGeneration={{
          input_text: "Hook. Hello [Pacing: slow]",
          speech_text: "Hook. Hello",
          voice_id: "Casual_Guy",
          emotion: "happy",
          gateway: "wavespeed_minimax_speech",
        }}
        defaultExpanded
      />,
    );

    expect(screen.getByText("Exact text sent for scene voice")).toBeInTheDocument();
    expect(screen.getByText(/Speech text \(sent to TTS\)/)).toBeInTheDocument();
    expect(screen.getByText("Hook. Hello")).toBeInTheDocument();
  });
});
