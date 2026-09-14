/**
 * Plan Your Video — existing PlanStep fields and actions.
 * Does not cover the two-pane UX rearrangement.
 */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanStep } from "../components/PlanStep";
import type { YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";

const mockOpenYouTubePlanFromCreator = vi.fn();

vi.mock("../dashboard/youtubeStudioEvents", () => ({
  openYouTubePlanFromCreator: (...args: unknown[]) => mockOpenYouTubePlanFromCreator(...args),
}));
vi.mock("../components/ChannelBiblePanel", () => ({
  ChannelBiblePanel: () => <div data-testid="channel-bible-panel" />,
}));
vi.mock("../components/PlanPromptPreview", () => ({
  PlanPromptPreview: () => null,
}));
vi.mock("../../shared/AssetLibraryImageModal", () => ({
  AssetLibraryImageModal: () => null,
}));
vi.mock("../hooks/useAvatarBlobUrl", () => ({
  useAvatarBlobUrl: () => ({ avatarBlobUrl: null, avatarLoading: false }),
}));

const SAMPLE_PITCH: YouTubeVideoPitch = {
  id: "pitch-1",
  creative_angle: "Contrarian",
  selected_title: "Stop Overpacking",
  video_summary: "Pack three items.",
  hook_concept: "Skip the suitcase.",
  main_content_beats: ["Rule one"],
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

describe("YouTube PlanStep existing fields", () => {
  beforeEach(() => {
    mockOpenYouTubePlanFromCreator.mockClear();
  });

  it("shows idea, type, audience, goal, style, duration, and language", () => {
    renderPlanStep();
    expect(screen.getByDisplayValue("Budget travel packing")).toBeTruthy();
    expect(screen.getByText("What's your video about?")).toBeTruthy();
    expect(screen.getByText("Video Type")).toBeTruthy();
    expect(screen.getByText("Target Audience")).toBeTruthy();
    expect(screen.getByText("Primary Goal")).toBeTruthy();
    expect(screen.getByText("Brand Style / Visual Aesthetic")).toBeTruthy();
    expect(screen.getByText("Video Duration")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Shorts" })).toBeTruthy();
    expect(screen.getByText("Content Language")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
  });

  it("notifies onIdeaChange when the idea is edited", () => {
    const { props } = renderPlanStep();
    fireEvent.change(screen.getByDisplayValue("Budget travel packing"), {
      target: { value: "Tokyo 48 hours" },
    });
    expect(props.onIdeaChange).toHaveBeenCalledWith("Tokyo 48 hours");
  });

  it("selects medium duration and educational video type", () => {
    const { props } = renderPlanStep();
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));
    expect(props.onDurationChange).toHaveBeenCalledWith("medium");
    expect(props.onAspectRatioChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByText(/Select video type/i));
    fireEvent.click(screen.getByRole("option", { name: /Educational \/ Explainer/i }));
    expect(props.onVideoTypeChange).toHaveBeenCalledWith("educational");
  });

  it("selects Hindi as content language", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getByText("English"));
    fireEvent.click(screen.getByRole("option", { name: "Hindi" }));
    expect(props.onLanguageChange).toHaveBeenCalledWith("hi");
  });

  it("selects a preset target audience", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[0]);
    fireEvent.click(screen.getByRole("option", { name: /Travelers & Adventurers/i }));
    expect(props.onTargetAudienceChange).toHaveBeenCalledWith("travelers");
  });

  it("selects a preset primary goal", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[1]);
    fireEvent.click(screen.getByRole("option", { name: /Educate & Inform/i }));
    expect(props.onVideoGoalChange).toHaveBeenCalledWith("educate");
  });

  it("lists all current video types in the type menu", () => {
    renderPlanStep();
    fireEvent.mouseDown(screen.getByText(/Select video type/i));
    expect(screen.getByRole("option", { name: /Tutorial \/ How-To/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Review \/ Unboxing/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Educational \/ Explainer/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Entertainment/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Vlog \/ Personal/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Product Demo \/ Commercial/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Reaction \/ Commentary/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Storytelling \/ Documentary/i })).toBeTruthy();
  });

  it("keeps Generate Pitch disabled without an idea", () => {
    renderPlanStep({ userIdea: "   " });
    expect(screen.getByRole("button", { name: /generate pitch/i })).toBeDisabled();
  });

  it("keeps Generate Pitch disabled without a creative angle", () => {
    renderPlanStep({ creativeAngle: "" });
    expect(screen.getByRole("button", { name: /generate pitch/i })).toBeDisabled();
  });

  it("calls onGeneratePitch when idea and angle are set", () => {
    const { props } = renderPlanStep();
    fireEvent.click(screen.getByRole("button", { name: /generate pitch/i }));
    expect(props.onGeneratePitch).toHaveBeenCalledTimes(1);
  });

  it("shows expand and regenerate instead of Generate Pitch after a pitch exists", () => {
    const { props } = renderPlanStep({
      currentPitch: SAMPLE_PITCH,
      scriptPhase: "pitch",
    });
    expect(screen.queryByRole("button", { name: /generate pitch/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /expand to full script/i }));
    expect(props.onExpandPitch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /try another angle \/ regenerate/i }));
    expect(props.onRegeneratePitch).toHaveBeenCalledTimes(1);
  });

  it("disables generate while loading and shows pitch progress", () => {
    renderPlanStep({ loading: true });
    expect(screen.getByRole("button", { name: /generate pitch/i })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("shows Brainstorm and Blog/URL shortcuts from the idea field", () => {
    renderPlanStep();
    fireEvent.click(screen.getByRole("button", { name: /brainstorm video idea/i }));
    expect(mockOpenYouTubePlanFromCreator).toHaveBeenCalledWith({
      sub: "brainstorm",
      seed: "Budget travel packing",
    });
    fireEvent.click(screen.getByRole("button", { name: /blog \/ url → video/i }));
    expect(mockOpenYouTubePlanFromCreator).toHaveBeenCalledWith({
      sub: "url-import",
      seed: "Budget travel packing",
    });
  });

  it("shows optional avatar upload when no photo is set", () => {
    renderPlanStep();
    expect(screen.getByText(/Upload Your Photo \(Optional\)/i)).toBeTruthy();
    expect(screen.getByText("Creator Avatar & Visual Style")).toBeTruthy();
  });

  it("forwards an avatar file to onAvatarUpload", () => {
    const { props } = renderPlanStep();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["avatar"], "face.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onAvatarUpload).toHaveBeenCalledWith(file);
  });

  it("toggles web research from the Plan step", () => {
    const { props } = renderPlanStep({ enableResearch: true });
    fireEvent.click(screen.getByLabelText("Enable web research for plan"));
    expect(props.onEnableResearchChange).toHaveBeenCalledWith(false);
  });

  it("shows the idea helper copy used on Plan", () => {
    renderPlanStep();
    expect(screen.getByText(/Describe the topic in 1–2 sentences/i)).toBeTruthy();
    expect(screen.queryByText(/your goal \(views, subscribers, sales/i)).toBeNull();
    expect(
      screen.getByPlaceholderText(/Budget travel packing for a Tokyo weekend/i),
    ).toBeTruthy();
  });

  it("lists shorts, medium, and long duration choices", () => {
    renderPlanStep();
    expect(screen.getByRole("button", { name: "Shorts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Medium" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Long" })).toBeTruthy();
  });

  it("shows the idea field before Channel Bible", () => {
    renderPlanStep();
    const idea = screen.getByText("What's your video about?");
    const bible = screen.getByTestId("channel-bible-panel");
    expect(idea.compareDocumentPosition(bible) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders idea and basic setup as two separate pane cards", () => {
    const { container } = renderPlanStep();
    expect(container.querySelectorAll(".yt-plan-pane")).toHaveLength(2);
    expect(screen.getByLabelText("Step 1")).toBeTruthy();
    expect(screen.getByLabelText("Step 2")).toBeTruthy();
  });

  it("lists additional content languages from Plan", () => {
    renderPlanStep();
    fireEvent.mouseDown(screen.getByText("English"));
    expect(screen.getByRole("option", { name: "Spanish" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Japanese" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Arabic" })).toBeTruthy();
  });

  it("opens custom audience entry from Plan", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[0]);
    fireEvent.click(screen.getByRole("option", { name: /\+ Enter custom/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/Tech-savvy professionals aged 25-40/i),
      { target: { value: "Parents of toddlers" } },
    );
    expect(props.onTargetAudienceChange).toHaveBeenCalledWith("Parents of toddlers");
  });

  it("opens custom primary goal entry from Plan", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[1]);
    fireEvent.click(screen.getByRole("option", { name: /\+ Enter custom/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/Educate viewers on AI basics/i),
      { target: { value: "Get parents to subscribe" } },
    );
    expect(props.onVideoGoalChange).toHaveBeenCalledWith("Get parents to subscribe");
  });

  it("opens custom brand style entry from Plan", () => {
    const { props } = renderPlanStep();
    fireEvent.mouseDown(screen.getAllByText(/Select an option\.\.\./i)[2]);
    fireEvent.click(screen.getByRole("option", { name: /\+ Enter custom/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/Modern minimalist, tech-forward/i),
      { target: { value: "soft 3D classroom" } },
    );
    expect(props.onBrandStyleChange).toHaveBeenCalledWith("soft 3D classroom");
  });
});
