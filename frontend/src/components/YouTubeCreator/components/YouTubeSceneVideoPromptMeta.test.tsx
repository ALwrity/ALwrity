import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { YouTubeSceneVideoPromptMeta } from "./YouTubeSceneVideoPromptMeta";
import { YouTubeSceneVideoPromptPreview } from "./YouTubeSceneVideoPromptPreview";
import type { Scene } from "../../../services/youtubeApi";

const scene: Scene = {
  scene_number: 1,
  title: "Hook",
  narration: "Hello",
  visual_prompt: "A studio shot of a creator",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  imageUrl: "/img.png",
  audioUrl: "/voice.mp3",
};

describe("YouTube scene video prompt UI", () => {
  it("shows preview of the prompt that will be sent", () => {
    render(<YouTubeSceneVideoPromptPreview scene={scene} />);

    expect(screen.getByText(/There is no system prompt/)).toBeInTheDocument();
    expect(screen.getByText(/A studio shot of a creator/)).toBeInTheDocument();
    expect(screen.getByText(/Mode: i2v/)).toBeInTheDocument();
    expect(screen.getByText(/Path: \/img\.png/)).toBeInTheDocument();
    expect(screen.getByText(/Path: \/voice\.mp3/)).toBeInTheDocument();
    expect(screen.getByText(/negative_prompt: not sent/)).toBeInTheDocument();
  });

  it("shows exact prompt after generate", () => {
    render(
      <YouTubeSceneVideoPromptMeta
        generation={{
          visual_prompt: "Enhanced cinematic shot",
          generation_mode: "i2v",
          gateway: "wavespeed_wan25",
          model: "wan-2.5",
          duration: 5,
          enable_prompt_expansion: true,
          image_attached: true,
          audio_attached: true,
          image_url: "/img.png",
          audio_url: "/voice.mp3",
        }}
        defaultExpanded
      />,
    );

    expect(screen.getByText("Exact request sent for scene video")).toBeInTheDocument();
    expect(screen.getByText(/Enhanced cinematic shot/)).toBeInTheDocument();
    expect(screen.getByText("Copy full request")).toBeInTheDocument();
    expect(screen.getByText(/Path: \/img\.png/)).toBeInTheDocument();
  });
});
