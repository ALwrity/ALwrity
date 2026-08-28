import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { Scene } from "../../../../services/youtubeApi";
import type { AudioGenerationSettings } from "../../../shared/AudioSettingsModal";
import { GenerationModals } from "./GenerationModals";
import { buildYoutubeSceneSpeechText } from "../../panel/buildEnrichedSceneText";

const theme = createTheme();

const scene: Scene = {
  scene_number: 1,
  title: "Hook",
  narration: "Open with a question.",
  visual_prompt: "A traveler at a sunlit airport gate",
  duration_estimate: 8,
  visual_cues: [],
  emphasis_tags: [],
};

const audioSettings: AudioGenerationSettings = {
  voiceId: "Casual_Guy",
  speed: 1.15,
  volume: 1.0,
  pitch: 0.0,
  emotion: "happy",
  englishNormalization: true,
  bitrate: 128000,
  channel: "1",
  format: "mp3",
  enableSyncMode: true,
};

describe("GenerationModals — Generate Assets overlay smoke", () => {
  it("opens the image modal on document.body and submits it", () => {
    const onImageSettingsApply = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <GenerationModals
          scene={scene}
          showAudioSettingsModal={false}
          setShowAudioSettingsModal={vi.fn()}
          showImageSettingsModal
          setShowImageSettingsModal={vi.fn()}
          currentAudioSettings={audioSettings}
          onAudioSettingsApply={vi.fn()}
          onImageSettingsApply={onImageSettingsApply}
        />
      </ThemeProvider>,
    );

    const imageDialog = screen.getByRole("dialog", { name: /Generate Scene Image/i });
    expect(imageDialog).toBeVisible();
    expect(imageDialog.closest(".yt-modal-backdrop")).toBeNull();
    expect(imageDialog.closest(".MuiModal-root")?.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole("button", { name: "Generate Image" }));
    expect(onImageSettingsApply).toHaveBeenCalledTimes(1);
    expect(onImageSettingsApply).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: scene.visual_prompt,
        style: "Realistic",
        model: "ideogram-v3-turbo",
      }),
    );
  });

  it("opens the audio modal on document.body and submits it", () => {
    const onAudioSettingsApply = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <GenerationModals
          scene={scene}
          showAudioSettingsModal
          setShowAudioSettingsModal={vi.fn()}
          showImageSettingsModal={false}
          setShowImageSettingsModal={vi.fn()}
          currentAudioSettings={audioSettings}
          onAudioSettingsApply={onAudioSettingsApply}
          onImageSettingsApply={vi.fn()}
        />
      </ThemeProvider>,
    );

    const audioHeading = screen.getByText(/Generate Audio/i);
    const audioDialog = audioHeading.closest("[role='dialog']");
    expect(audioDialog).toBeTruthy();
    expect(audioDialog).toBeVisible();
    expect(audioDialog?.closest(".yt-modal-backdrop")).toBeNull();
    expect(audioDialog?.closest(".MuiModal-root")?.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole("button", { name: "Apply Settings & Generate" }));
    expect(onAudioSettingsApply).toHaveBeenCalledTimes(1);
    expect(onAudioSettingsApply).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "Casual_Guy" }),
    );

    const speechPayload = buildYoutubeSceneSpeechText(scene);
    expect(speechPayload).toBe(scene.narration);
    expect(speechPayload).not.toContain(scene.title);
    expect(speechPayload).not.toMatch(/\[Speak at/i);
    expect(speechPayload).not.toMatch(/\[Pacing:/i);
  });
});
