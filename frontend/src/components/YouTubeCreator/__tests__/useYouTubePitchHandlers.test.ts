/**
 * Plan Your Video Phase 1: pitch/expand handlers forward content language.
 */

import { renderHook, act } from "@testing-library/react";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubePitchHandlers } from "../panel/useYouTubePitchHandlers";

vi.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    generatePitch: vi.fn(),
    expandPitchToScript: vi.fn(),
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
      research_prompt_block:
        "Use only these facts. Do not invent statistics or numbers.\n\n1. Carry-on packing",
      research_sources: [{ title: "Guide", url: "https://example.com/a" }],
    },
    pitchHistory: [],
    updateState: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setSuccess: vi.fn(),
    setActiveStep: vi.fn(),
  };
}

describe("useYouTubePitchHandlers language contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards language on generatePitch", async () => {
    vi.mocked(youtubeApi.generatePitch).mockResolvedValue({
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
    expect(vi.mocked(youtubeApi.generatePitch).mock.calls[0][0]).not.toHaveProperty("plan_category");
  });

  it("sends pack-filled producer fields on generatePitch without a plan_category key", async () => {
    vi.mocked(youtubeApi.generatePitch).mockResolvedValue({
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
    const args = {
      ...buildArgs(),
      videoType: "storytelling" as const,
      targetAudience: "kids_and_families",
      videoGoal: "educate",
      brandStyle: "playful_fun",
    };
    const { result } = renderHook(() => useYouTubePitchHandlers(args));

    await act(async () => {
      await result.current.handleGeneratePitch();
    });

    const payload = vi.mocked(youtubeApi.generatePitch).mock.calls[0][0];
    expect(payload).not.toHaveProperty("plan_category");
    expect(payload).toEqual(
      expect.objectContaining({
        video_type: "storytelling",
        target_audience: "kids_and_families",
        video_goal: "educate",
        brand_style: "playful_fun",
      }),
    );
  });

  it("forwards language on expandPitchToScript", async () => {
    vi.mocked(youtubeApi.expandPitchToScript).mockResolvedValue({
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
      expect.objectContaining({
        language: "hi",
        approved_pitch: expect.objectContaining({
          research_prompt_block:
            "Use only these facts. Do not invent statistics or numbers.\n\n1. Carry-on packing",
          research_sources: [{ title: "Guide", url: "https://example.com/a" }],
        }),
      }),
    );
  });

  it("sends English when language is unknown", async () => {
    vi.mocked(youtubeApi.generatePitch).mockResolvedValue({
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
