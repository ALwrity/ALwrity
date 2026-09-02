/**
 * Render step shows publish metadata for one scene or combined output.
 * Existing URL coverage stays in components/YouTubeRenderStepPublish.test.tsx.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RenderStep } from "../components/RenderStep";
import { useYouTubeRenderQueue } from "../hooks/useYouTubeRenderQueue";
import type { Scene, VideoPlan } from "../../../services/youtubeApi";

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
vi.mock("../components/YouTubeFinalVideoPanel", () => ({
  YouTubeFinalVideoPanel: () => <div data-testid="youtube-final-panel" />,
}));
vi.mock("../components/YouTubePublishPanel", () => ({
  YouTubePublishPanel: (props: {
    videoUrl?: string | null;
    metadata?: { title?: string; tags?: string[]; category_id?: string };
  }) => (
    <>
      <div data-testid="youtube-publish-video-url">{props.videoUrl ?? ""}</div>
      <div data-testid="youtube-publish-title">{props.metadata?.title ?? ""}</div>
      <div data-testid="youtube-publish-tags">{(props.metadata?.tags || []).join(",")}</div>
      <div data-testid="youtube-publish-category">{props.metadata?.category_id ?? ""}</div>
    </>
  ),
}));

const mockedQueue = vi.mocked(useYouTubeRenderQueue);

const combinedScenes: Scene[] = [
  {
    scene_number: 1,
    title: "Intro",
    narration: "Narration",
    visual_prompt: "Visual",
    duration_estimate: 5,
    visual_cues: [],
    emphasis_tags: [],
    enabled: true,
    videoUrl: "/api/youtube/videos/scene_1.mp4",
  },
  {
    scene_number: 2,
    title: "Body",
    narration: "Narration",
    visual_prompt: "Visual",
    duration_estimate: 5,
    visual_cues: [],
    emphasis_tags: [],
    enabled: true,
    videoUrl: "/api/youtube/videos/scene_2.mp4",
  },
];

const singleScene: Scene[] = [combinedScenes[0]];

const combinedPlan: VideoPlan = {
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

function queueReturn(finalVideoUrl: string | null) {
  return {
    sceneStatuses: {},
    finalVideoUrl,
    combinedFromThisSession: false,
    combining: false,
    combiningProgress: 0,
    combiningMessage: "",
    runSceneVideo: vi.fn(),
    combineVideos: vi.fn(),
  };
}

function renderStepUi(
  overrides: {
    scenes?: Scene[];
    videoPlan?: VideoPlan | null;
    combineScenes?: boolean;
    getVideoUrl?: () => string | null;
    enabledScenesCount?: number;
  } = {},
) {
  const scenes = overrides.scenes ?? combinedScenes;
  return (
    <RenderStep
      renderTaskId={null}
      renderStatus={null}
      renderProgress={0}
      resolution="720p"
      combineScenes={overrides.combineScenes ?? true}
      enabledScenesCount={overrides.enabledScenesCount ?? scenes.length}
      costEstimate={null}
      loadingCostEstimate={false}
      loading={false}
      scenes={scenes}
      videoPlan={overrides.videoPlan ?? combinedPlan}
      onResolutionChange={vi.fn()}
      onCombineScenesChange={vi.fn()}
      onStartRender={vi.fn()}
      onBack={vi.fn()}
      onReset={vi.fn()}
      onRetryFailedScenes={vi.fn()}
      onScenesUpdate={vi.fn()}
      getVideoUrl={overrides.getVideoUrl ?? (() => null)}
    />
  );
}

function renderRenderStep(
  overrides: {
    scenes?: Scene[];
    videoPlan?: VideoPlan | null;
    combineScenes?: boolean;
    getVideoUrl?: () => string | null;
    enabledScenesCount?: number;
    finalVideoUrl?: string | null;
  } = {},
) {
  mockedQueue.mockReturnValue(
    queueReturn(overrides.finalVideoUrl === undefined ? "/api/youtube/videos/final.mp4" : overrides.finalVideoUrl),
  );
  const view = render(renderStepUi(overrides));
  return {
    ...view,
    rerenderStep: (
      next: {
        scenes?: Scene[];
        videoPlan?: VideoPlan | null;
        combineScenes?: boolean;
        getVideoUrl?: () => string | null;
        enabledScenesCount?: number;
      } = {},
    ) => view.rerender(renderStepUi({ ...overrides, ...next })),
  };
}

describe("RenderStep publish metadata on the render step", () => {
  beforeEach(() => {
    mockedQueue.mockReset();
    mockedQueue.mockReturnValue(queueReturn("/api/youtube/videos/final.mp4"));
  });

  it("shows Title, Description, Tags, and Category for a single scene video", () => {
    renderRenderStep({
      scenes: singleScene,
      combineScenes: false,
      finalVideoUrl: null,
      getVideoUrl: () => null,
    });

    expect(screen.queryByTestId("youtube-final-panel")).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Rank Videos in 7 Days");
    expect(screen.getByLabelText("Description")).toHaveProperty(
      "value",
      "Use searchable titles and retention hooks.",
    );
    expect(screen.getByLabelText("Tags")).toHaveProperty("value", "youtube seo, retention");
    expect(screen.getByLabelText("Category")).toHaveProperty("value", "22");
    expect(screen.getByText("People & Blogs")).not.toBeNull();
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Rank Videos in 7 Days");
    expect(screen.getByTestId("youtube-publish-tags").textContent).toBe("youtube seo,retention");
    expect(screen.getByTestId("youtube-publish-category").textContent).toBe("22");
  });

  it("shows one set of metadata fields when two scene videos can be combined", () => {
    renderRenderStep();

    expect(screen.getAllByLabelText("Title")).toHaveLength(1);
    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Rank Videos in 7 Days");
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Rank Videos in 7 Days");
    expect(screen.getByTestId("youtube-publish-tags").textContent).toBe("youtube seo,retention");
    expect(screen.getByTestId("youtube-publish-category").textContent).toBe("22");
  });

  it("publishes the first enabled scene clip when combine and getVideoUrl are empty", () => {
    renderRenderStep({
      scenes: singleScene,
      combineScenes: false,
      finalVideoUrl: null,
      getVideoUrl: () => null,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(
      "/api/youtube/videos/scene_1.mp4",
    );
  });

  it("rebuilds unedited metadata when the plan changes after mount", () => {
    const { rerenderStep } = renderRenderStep();

    rerenderStep({
      videoPlan: {
        ...combinedPlan,
        selected_title: "New Rank Title",
        seo_keywords: ["ai video", "ranking"],
      },
    });

    expect(screen.getByLabelText("Title")).toHaveProperty("value", "New Rank Title");
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("New Rank Title");
    expect(screen.getByTestId("youtube-publish-tags").textContent).toBe("ai video,ranking");
  });

  it("keeps an edited title when only scene video URLs change", () => {
    const { rerenderStep } = renderRenderStep();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Edited title");

    rerenderStep({
      scenes: combinedScenes.map((item, index) =>
        index === 0 ? { ...item, videoUrl: "/api/youtube/videos/scene_1_v2.mp4" } : item,
      ),
    });

    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Edited title");
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Edited title");
    expect(screen.getByTestId("youtube-publish-tags").textContent).toBe("youtube seo,retention");
  });

  it("keeps an edited title and applies new keywords when the plan updates", () => {
    const { rerenderStep } = renderRenderStep();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });

    rerenderStep({
      videoPlan: {
        ...combinedPlan,
        selected_title: "New Rank Title",
        seo_keywords: ["ai video", "ranking"],
      },
    });

    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Edited title");
    expect(screen.getByTestId("youtube-publish-title").textContent).toBe("Edited title");
    expect(screen.getByTestId("youtube-publish-tags").textContent).toBe("ai video,ranking");
  });
});
