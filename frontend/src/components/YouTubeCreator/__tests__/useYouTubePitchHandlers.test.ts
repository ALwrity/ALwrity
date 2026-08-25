/**
 * Plan Your Video Phase 1: pitch/expand handlers forward content language.
 */

import { renderHook, act } from "@testing-library/react";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubePitchHandlers } from "../panel/useYouTubePitchHandlers";

jest.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    generatePitch: jest.fn(),
    expandPitchToScript: jest.fn(),
  },
}));

function buildArgs() {
  return {
    userIdea: "Budget travel packing",
    durationType: "shorts" as const,
    videoType: "" as const,
    targetAudience: "",
    videoGoal: "",
    brandStyle: "",
    referenceImage: "",
    avatarUrl: null,
    enableResearch: false,
    sourceArticle: null,
    language: "hi" as const,
    creativeAngle: "Contrarian",
    currentPitch: {
      id: "pitch-1",
      creative_angle: "Contrarian",
      selected_title: "Stop Overpacking",
      video_summary: "Pack three items.",
      hook_concept: "Skip the suitcase.",
      main_content_beats: ["Rule one", "Rule two", "Rule three"],
    },
    pitchHistory: [],
    updateState: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    setSuccess: jest.fn(),
    setActiveStep: jest.fn(),
  };
}

describe("useYouTubePitchHandlers language contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards language on generatePitch", async () => {
    jest.mocked(youtubeApi.generatePitch).mockResolvedValue({
      success: true,
      pitch: {
        selected_title: "Stop Overpacking",
        video_summary: "Pack three items.",
        hook_concept: "Skip the suitcase.",
        main_content_beats: ["Rule one", "Rule two", "Rule three"],
        angle_used: "Contrarian",
      },
      message: "ok",
    });
    const args = buildArgs();
    const { result } = renderHook(() => useYouTubePitchHandlers(args));

    await act(async () => {
      await result.current.handleGeneratePitch();
    });

    expect(youtubeApi.generatePitch).toHaveBeenCalledWith(
      expect.objectContaining({ language: "hi", creative_angle: "Contrarian" }),
    );
  });

  it("forwards language on expandPitchToScript", async () => {
    jest.mocked(youtubeApi.expandPitchToScript).mockResolvedValue({
      success: true,
      expansion: {
        hook: { spoken_script: "Hook" },
        main_content_outline: [
          { scene_number: 1, section_title: "Beat", spoken_script: "Body", estimated_duration_seconds: 10 },
        ],
        full_script: "Hook\n\nBody",
        key_message: "Pack less",
        seo_keywords: [],
        outro: "Done",
        call_to_action: "Subscribe",
      },
      full_script: "Hook\n\nBody",
      message: "ok",
    });
    const args = buildArgs();
    const { result } = renderHook(() => useYouTubePitchHandlers(args));

    await act(async () => {
      await result.current.handleExpandPitch();
    });

    expect(youtubeApi.expandPitchToScript).toHaveBeenCalledWith(
      expect.objectContaining({ language: "hi" }),
    );
  });

  it("sends English when language is unknown", async () => {
    jest.mocked(youtubeApi.generatePitch).mockResolvedValue({
      success: true,
      pitch: {
        selected_title: "Stop Overpacking",
        video_summary: "Pack three items.",
        hook_concept: "Skip the suitcase.",
        main_content_beats: ["Rule one", "Rule two", "Rule three"],
        angle_used: "Contrarian",
      },
      message: "ok",
    });
    const args = { ...buildArgs(), language: "xx" as never };
    const { result } = renderHook(() => useYouTubePitchHandlers(args));

    await act(async () => {
      await result.current.handleGeneratePitch();
    });

    expect(youtubeApi.generatePitch).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" }),
    );
  });
});
