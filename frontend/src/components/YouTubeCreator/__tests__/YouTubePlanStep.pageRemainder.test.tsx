/**
 * Plan Your Video page remainder: Channel Bible, avatar, angle, prompt preview, pitch.
 * Locks current behavior before the two-pane UX change. No production edits.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanStep } from "../components/PlanStep";
import type { YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { youtubeApi } from "../../../services/youtubeApi";

vi.mock("../dashboard/youtubeStudioEvents", () => ({
  openYouTubePlanFromCreator: vi.fn(),
}));
vi.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    previewPitchPrompt: vi.fn(),
  },
}));
vi.mock("../../shared/OperationButton", () => ({
  OperationButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("../../shared/AssetLibraryImageModal", () => ({
  AssetLibraryImageModal: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (asset: { file_url?: string }) => void;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onSelect({ file_url: "https://cdn.example/a.png" })}>
          pick-library-avatar
        </button>
        <button type="button" onClick={() => onSelect({})}>
          pick-library-missing-url
        </button>
      </div>
    ) : null,
}));
vi.mock("../hooks/useAvatarBlobUrl", () => ({
  useAvatarBlobUrl: (preview?: string | null) => ({
    avatarBlobUrl: preview ? "blob:avatar-preview" : null,
    avatarLoading: preview === "loading",
  }),
}));

const SAMPLE_PITCH: YouTubeVideoPitch = {
  id: "pitch-1",
  creative_angle: "Contrarian",
  selected_title: "Stop Overpacking",
  video_summary: "Pack three items.",
  hook_concept: "Skip the suitcase.",
  main_content_beats: ["Rule one"],
  generation: {
    text_gateway: "llm_text_gen",
    system_prompt: "You are ALwrity Pitch.",
    user_prompt: "Generate a pitch for weekend packing.",
    json_schema_applied: true,
  },
};

const BIBLE: YouTubeChannelBible = {
  channel_name: "",
  niche: "Solo travel",
  target_audience: "Founders",
  default_video_goal: "",
  default_cta: "",
  brand_style: "",
  visual_style_guide: "",
  tone: "",
  default_avatar_url: null,
  default_language: "",
};

function renderPlanStep(
  overrides: Partial<React.ComponentProps<typeof PlanStep>> = {},
) {
  const props: React.ComponentProps<typeof PlanStep> = {
    userIdea: "Budget travel packing",
    durationType: "shorts",
    aspectRatio: "9:16",
    language: "en",
    loading: false,
    referenceImage: "",
    channelBible: null,
    enableResearch: false,
    creativeAngle: "Contrarian",
    currentPitch: null,
    pitchHistory: [],
    scriptPhase: "idle",
    onIdeaChange: vi.fn(),
    onDurationChange: vi.fn(),
    onAspectRatioChange: vi.fn(),
    onVideoTypeChange: vi.fn(),
    onTargetAudienceChange: vi.fn(),
    onVideoGoalChange: vi.fn(),
    onBrandStyleChange: vi.fn(),
    onReferenceImageChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onAvatarUpload: vi.fn(),
    onRemoveAvatar: vi.fn(),
    onMakePresentable: vi.fn(),
    onAvatarSelectFromLibrary: vi.fn(),
    onBibleChange: vi.fn(),
    onSaveBible: vi.fn(),
    onApplyBible: vi.fn(),
    onEnableResearchChange: vi.fn(),
    onCreativeAngleChange: vi.fn(),
    onGeneratePitch: vi.fn(),
    onRegeneratePitch: vi.fn(),
    onExpandPitch: vi.fn(),
    onSelectPitchFromHistory: vi.fn(),
    ...overrides,
  };
  return { ...render(<PlanStep {...props} />), props };
}

describe("YouTube PlanStep complete page remainder", () => {
  beforeEach(() => {
    vi.mocked(youtubeApi.previewPitchPrompt).mockReset();
    vi.mocked(youtubeApi.previewPitchPrompt).mockResolvedValue({
      success: true,
      system_prompt: "You are ALwrity Pitch.",
      user_prompt: 'Create ONE short video pitch for: "Budget travel packing"',
      message: "ok",
    });
  });

  it("shows the Plan heading and prompt preview entry", () => {
    renderPlanStep();
    expect(screen.getByText("1️⃣ Plan Your Video")).toBeTruthy();
    expect(screen.getByText("Prompt that will be sent")).toBeTruthy();
  });

  it("loads the pitch prompt preview from Plan after expand", async () => {
    renderPlanStep();
    fireEvent.click(screen.getByText("Prompt that will be sent"));
    await waitFor(
      () => {
        expect(youtubeApi.previewPitchPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            user_idea: "Budget travel packing",
            creative_angle: "Contrarian",
            duration_type: "shorts",
            language: "en",
          }),
        );
      },
      { timeout: 3000 },
    );
  });

  it("shows Channel Bible load warning when bible is missing", () => {
    renderPlanStep({ channelBible: null });
    expect(
      screen.getByText(/Could not load channel bible. You can still plan this video./i),
    ).toBeTruthy();
  });

  it("shows Channel Bible after the idea canvas", () => {
    renderPlanStep({ channelBible: BIBLE });
    const idea = screen.getByText("What's your video about?");
    const bible = screen.getByText("Channel Bible");
    expect(idea.compareDocumentPosition(bible) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("saves and applies Channel Bible from Plan", () => {
    const { props } = renderPlanStep({ channelBible: BIBLE });
    fireEvent.click(screen.getByText("Channel Bible"));
    fireEvent.click(screen.getByRole("button", { name: "Save channel defaults" }));
    expect(props.onSaveBible).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Apply to this video" }));
    expect(props.onApplyBible).toHaveBeenCalledTimes(1);
  });

  it("forwards Channel Bible field edits from Plan", () => {
    const { props } = renderPlanStep({ channelBible: BIBLE });
    fireEvent.click(screen.getByText("Channel Bible"));
    fireEvent.change(
      screen.getByPlaceholderText(/AI tools for founders/i),
      { target: { value: "Kids explainer toys" } },
    );
    expect(props.onBibleChange).toHaveBeenCalledWith(
      expect.objectContaining({ niche: "Kids explainer toys" }),
    );
  });

  it("shows a Channel Bible fetch error on Plan", () => {
    renderPlanStep({ channelBible: null, bibleError: "Channel bible request failed." });
    expect(screen.getByText("Channel bible request failed.")).toBeTruthy();
  });

  it("disables the Channel Bible accordion while defaults are loading", () => {
    renderPlanStep({ channelBible: BIBLE, bibleLoading: true });
    expect(screen.getByText("Channel Bible").closest(".Mui-disabled")).toBeTruthy();
  });

  it("copies the Plan avatar URL into Channel Bible", () => {
    const { props } = renderPlanStep({
      channelBible: BIBLE,
      avatarUrl: "https://cdn.example/face.png",
    });
    fireEvent.click(screen.getByText("Channel Bible"));
    fireEvent.click(screen.getByRole("button", { name: "Use current Plan avatar" }));
    expect(props.onBibleChange).toHaveBeenCalledWith(
      expect.objectContaining({ default_avatar_url: "https://cdn.example/face.png" }),
    );
  });

  it("shows Saving on Channel Bible while save is in flight", () => {
    renderPlanStep({ channelBible: BIBLE, bibleSaving: true });
    fireEvent.click(screen.getByText("Channel Bible"));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("selects brand style and long duration", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[2]);
    fireEvent.click(screen.getByRole("option", { name: /Modern Minimalist/i }));
    expect(props.onBrandStyleChange).toHaveBeenCalledWith("modern_minimalist");

    fireEvent.click(screen.getByRole("button", { name: "Long" }));
    expect(props.onDurationChange).toHaveBeenCalledWith("long");
    expect(props.onAspectRatioChange).not.toHaveBeenCalled();
  });

  it("updates the optional visual style guide", () => {
    const { props } = renderPlanStep();
    fireEvent.change(
      screen.getByPlaceholderText(/neon-lit Tokyo alley/i),
      { target: { value: "bright classroom, 3D toys" } },
    );
    expect(props.onReferenceImageChange).toHaveBeenCalledWith("bright classroom, 3D toys");
  });

  it("does not upload when the avatar file input is empty", () => {
    const { props } = renderPlanStep();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(props.onAvatarUpload).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[PlanStep] Avatar file input had no file");
    warn.mockRestore();
  });

  it("shows Uploading while an avatar file is in flight", () => {
    renderPlanStep({ uploadingAvatar: true });
    expect(screen.getByText("Uploading...")).toBeTruthy();
  });

  it("disables discovery shortcuts and research while loading", () => {
    renderPlanStep({ loading: true });
    expect(screen.getByRole("button", { name: /brainstorm video idea/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /blog \/ url → video/i })).toBeDisabled();
    expect(screen.getByLabelText("Enable web research for plan")).toBeDisabled();
    expect(screen.getByText("Generating pitch")).toBeTruthy();
  });

  it("forwards a creative angle chip from Plan", () => {
    const { props } = renderPlanStep({ creativeAngle: "" });
    fireEvent.click(screen.getByText("Beginner Breakdown"));
    expect(props.onCreativeAngleChange).toHaveBeenCalledWith("Beginner Breakdown");
  });

  it("accepts a custom creative angle from Plan", () => {
    const { props } = renderPlanStep({ creativeAngle: "Contrarian" });
    fireEvent.click(screen.getByText("Custom"));
    fireEvent.change(screen.getByLabelText("Custom creative angle"), {
      target: { value: "myth-busting expert" },
    });
    expect(props.onCreativeAngleChange).toHaveBeenCalledWith("myth-busting expert");
  });

  it("disables creative-angle chips while pitch is loading", () => {
    renderPlanStep({ loading: true });
    expect(screen.getByRole("button", { name: "Beginner Breakdown" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps Generate Pitch when a pitch exists but script phase is still idle", () => {
    renderPlanStep({ currentPitch: SAMPLE_PITCH, scriptPhase: "idle" });
    expect(screen.getByRole("button", { name: "Generate Pitch" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /expand to full script/i })).toBeNull();
  });

  it("disables expand and regenerate while expanding", () => {
    renderPlanStep({
      currentPitch: SAMPLE_PITCH,
      scriptPhase: "expanding",
    });
    expect(screen.getByRole("button", { name: /expanding to full script/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /try another angle \/ regenerate/i })).toBeDisabled();
  });

  it("shows the pitch card, LLM prompt heading, and history on Plan", () => {
    const older: YouTubeVideoPitch = {
      ...SAMPLE_PITCH,
      id: "pitch-2",
      selected_title: "Second pitch",
    };
    const { props } = renderPlanStep({
      currentPitch: SAMPLE_PITCH,
      pitchHistory: [SAMPLE_PITCH, older],
      scriptPhase: "pitch",
    });
    expect(screen.getAllByText("Stop Overpacking").length).toBeGreaterThan(0);
    expect(screen.getByText("Exact pitch prompt sent to the LLM")).toBeTruthy();
    fireEvent.click(screen.getByText("Second pitch"));
    expect(props.onSelectPitchFromHistory).toHaveBeenCalledWith(older);
  });

  it("opens the asset library and forwards a selected avatar", () => {
    const { props } = renderPlanStep();
    fireEvent.click(screen.getByRole("button", { name: /upload from asset library/i }));
    fireEvent.click(screen.getByRole("button", { name: "pick-library-avatar" }));
    expect(props.onAvatarSelectFromLibrary).toHaveBeenCalledWith({
      file_url: "https://cdn.example/a.png",
    });
  });

  it("skips a library pick with no file_url", () => {
    const { props } = renderPlanStep();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: /upload from asset library/i }));
    fireEvent.click(screen.getByRole("button", { name: "pick-library-missing-url" }));
    expect(props.onAvatarSelectFromLibrary).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[PlanStep] Asset library selection skipped: missing file_url",
    );
    warn.mockRestore();
  });

  it("shows avatar preview actions and Make Presentable", () => {
    const { props } = renderPlanStep({
      avatarPreview: "https://cdn.example/face.png",
      avatarUrl: "https://cdn.example/face.png",
    });
    expect(screen.getByAltText("Avatar preview")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Make Presentable" }));
    expect(props.onMakePresentable).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /upload from asset library/i }));
    expect(screen.getByRole("button", { name: "pick-library-avatar" })).toBeTruthy();
  });

  it("disables Make Presentable while the photo is transforming", () => {
    renderPlanStep({
      avatarPreview: "https://cdn.example/face.png",
      makingPresentable: true,
    });
    expect(screen.getByRole("button", { name: "Make Presentable" })).toBeDisabled();
  });

  it("shows avatar loading and remove", () => {
    const { props } = renderPlanStep({ avatarPreview: "loading" });
    expect(screen.getByText("Loading...")).toBeTruthy();
    const remove = screen.getByText("Loading...").parentElement?.parentElement?.querySelector("button");
    expect(remove).toBeTruthy();
    fireEvent.click(remove as HTMLButtonElement);
    expect(props.onRemoveAvatar).toHaveBeenCalledTimes(1);
  });

  it("shows untitled pitch copy when the title is empty", () => {
    renderPlanStep({
      currentPitch: { ...SAMPLE_PITCH, selected_title: "" },
      scriptPhase: "pitch",
    });
    expect(screen.getByText("Untitled pitch")).toBeTruthy();
  });

  it("renders pitch hook and main beats on Plan", () => {
    renderPlanStep({ currentPitch: SAMPLE_PITCH, scriptPhase: "pitch" });
    expect(screen.getByText("Hook concept")).toBeTruthy();
    expect(screen.getByText("Skip the suitcase.")).toBeTruthy();
    expect(screen.getByText("Main beats")).toBeTruthy();
    expect(screen.getByText("Rule one")).toBeTruthy();
  });

  it("keeps expand actions when the script phase is ready", () => {
    renderPlanStep({ currentPitch: SAMPLE_PITCH, scriptPhase: "ready" });
    expect(screen.getByRole("button", { name: /expand to full script/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Pitch" })).toBeNull();
  });

  it("does not fetch prompt preview until a creative angle is set", async () => {
    renderPlanStep({ creativeAngle: "" });
    fireEvent.click(screen.getByText("Prompt that will be sent"));
    expect(
      await screen.findByText(/Enter a video idea and creative angle/i),
    ).toBeTruthy();
    expect(youtubeApi.previewPitchPrompt).not.toHaveBeenCalled();
  });

  it("disables Channel Bible while pitch generation is in flight", () => {
    renderPlanStep({ channelBible: BIBLE, loading: true });
    expect(screen.getByText("Channel Bible").closest(".Mui-disabled")).toBeTruthy();
  });

  it("hints when Channel Bible identity fields are empty", () => {
    const emptyBible: YouTubeChannelBible = {
      ...BIBLE,
      niche: "",
      target_audience: "",
      brand_style: "",
      default_cta: "",
    };
    renderPlanStep({ channelBible: emptyBible });
    fireEvent.click(screen.getByText("Channel Bible"));
    expect(
      screen.getByText(
        /Save your channel defaults so the next video starts with your niche, audience, style, and CTA./i,
      ),
    ).toBeTruthy();
  });
});
