/**
 * TDD: edited Render publish metadata is reported for draft persist and restored on remount.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RenderStep } from "../components/RenderStep";
import { useYouTubeRenderQueue } from "../hooks/useYouTubeRenderQueue";
import type { Scene, VideoPlan } from "../../../services/youtubeApi";
import type { YouTubePublishMetadata } from "../components/youtubePublishMetadata";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock("../hooks/useYouTubeRenderQueue");
vi.mock("../components/CombinedSceneOverview", () => ({ CombinedSceneOverview: () => null }));
vi.mock("../components/CostEstimateCard", () => ({ CostEstimateCard: () => null }));
vi.mock("../components/RenderSettings", () => ({ RenderSettings: () => null }));
vi.mock("../components/RenderStatusDisplay", () => ({ RenderStatusDisplay: () => null }));
vi.mock("../components/YouTubeSceneVideoPromptPanel", () => ({
  YouTubeSceneVideoPromptPanel: () => null,
}));
vi.mock("../components/SceneVideoActions", () => ({ SceneVideoActions: () => null }));
vi.mock("../components/ScenePreviewModal", () => ({ ScenePreviewModal: () => null }));
vi.mock("../components/YouTubeFinalVideoPanel", () => ({ YouTubeFinalVideoPanel: () => null }));
vi.mock("../components/YouTubePublishPanel", () => ({
  YouTubePublishPanel: (props: { metadata?: { title?: string } }) => (
    <div data-testid="youtube-publish-title">{props.metadata?.title ?? ""}</div>
  ),
}));

const mockedQueue = vi.mocked(useYouTubeRenderQueue);

const scene: Scene = {
  scene_number: 1,
  title: "Intro",
  narration: "Narration",
  visual_prompt: "Visual",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  enabled: true,
  videoUrl: "/api/youtube/videos/scene_1.mp4",
};

const plan: VideoPlan = {
  video_summary: "How to rank YouTube videos fast",
  target_audience: "Creators",
  key_message: "Use searchable titles and retention hooks.",
  content_outline: [],
  hook_strategy: "Hook",
  visual_style: "Modern",
  seo_keywords: ["youtube seo", "retention"],
  duration_type: "medium",
  selected_title: "Rank Videos in 7 Days",
};

const edited: YouTubePublishMetadata = {
  title: "Edited title",
  description: "Edited description",
  tags: ["seo", "ranking"],
  category_id: "27",
};

function renderStep(overrides: {
  persistedPublishMetadata?: YouTubePublishMetadata | null;
  onPublishMetadataChange?: (next: YouTubePublishMetadata) => void;
} = {}) {
  mockedQueue.mockReturnValue({
    sceneStatuses: {},
    finalVideoUrl: null,
    combinedFromThisSession: false,
    combining: false,
    combiningProgress: 0,
    combiningMessage: "",
    runSceneVideo: vi.fn(),
    combineVideos: vi.fn(),
  });

  return render(
    <RenderStep
      renderTaskId={null}
      renderStatus={null}
      renderProgress={0}
      resolution="720p"
      combineScenes={false}
      enabledScenesCount={1}
      costEstimate={null}
      loadingCostEstimate={false}
      loading={false}
      scenes={[scene]}
      videoPlan={plan}
      onResolutionChange={vi.fn()}
      onCombineScenesChange={vi.fn()}
      onStartRender={vi.fn()}
      onBack={vi.fn()}
      onReset={vi.fn()}
      onRetryFailedScenes={vi.fn()}
      onScenesUpdate={vi.fn()}
      getVideoUrl={() => null}
      persistedPublishMetadata={overrides.persistedPublishMetadata}
      onPublishMetadataChange={overrides.onPublishMetadataChange}
    />,
  );
}

describe("RenderStep persist publish metadata across refresh", () => {
  beforeEach(() => {
    mockedQueue.mockReset();
  });

  it("reports edited metadata so the creator draft can persist it", () => {
    const onPublishMetadataChange = vi.fn();
    renderStep({ onPublishMetadataChange });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });

    expect(onPublishMetadataChange.mock.calls.map((call) => call[0].title)).toEqual(
      expect.arrayContaining(["Edited title"]),
    );
  });

  it("shows persisted edited metadata after remount instead of rebuilding from the plan", () => {
    renderStep({ persistedPublishMetadata: edited });

    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Edited title");
    expect(screen.getByLabelText("Description")).toHaveProperty("value", "Edited description");
    expect(screen.getByLabelText("Tags")).toHaveProperty("value", "seo, ranking");
    expect(screen.getByLabelText("Category")).toHaveProperty("value", "27");
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Edited title");
  });
});
