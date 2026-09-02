/**
 * TDD: Render must pass this-draft video to Publish, not a rescued combined file.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { RenderStep } from "../components/RenderStep";
import { useYouTubeRenderQueue } from "../hooks/useYouTubeRenderQueue";
import type { Scene } from "../../../services/youtubeApi";

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
vi.mock("../components/YouTubeFinalVideoPanel", () => ({ YouTubeFinalVideoPanel: () => null }));
vi.mock("../components/YouTubeSceneVideoPromptPanel", () => ({
  YouTubeSceneVideoPromptPanel: () => null,
}));
vi.mock("../components/SceneVideoActions", () => ({ SceneVideoActions: () => null }));
vi.mock("../components/ScenePreviewModal", () => ({ ScenePreviewModal: () => null }));
vi.mock("../components/YouTubePublishPanel", () => ({
  YouTubePublishPanel: (props: {
    videoUrl?: string | null;
    publishLine?: string | null;
    helperText?: string | null;
  }) => (
    <>
      <div data-testid="youtube-publish-video-url">{props.videoUrl ?? ""}</div>
      <div data-testid="youtube-publish-line">{props.publishLine ?? ""}</div>
      <div data-testid="youtube-publish-helper">{props.helperText ?? ""}</div>
    </>
  ),
}));

const mockedQueue = vi.mocked(useYouTubeRenderQueue);

const RESCUED_COMBINED = "/api/youtube/videos/combined_yesterday.mp4";
const SESSION_COMBINED = "/api/youtube/videos/combined_this_session.mp4";
const LEFTOVER_RENDER = "/api/youtube/videos/old_batch_final.mp4";
const SCENE_1 = "/api/youtube/videos/scene_1_new.mp4";
const SCENE_2 = "/api/youtube/videos/scene_2_new.mp4";

const clip = (n: number, url?: string): Scene => ({
  scene_number: n,
  title: `Scene ${n}`,
  narration: "Narration",
  visual_prompt: "Visual",
  duration_estimate: 5,
  visual_cues: [],
  emphasis_tags: [],
  enabled: true,
  videoUrl: url,
});

function queueState(
  overrides: Partial<ReturnType<typeof useYouTubeRenderQueue>> = {},
): ReturnType<typeof useYouTubeRenderQueue> {
  return {
    sceneStatuses: {},
    finalVideoUrl: null,
    combinedFromThisSession: false,
    combining: false,
    combiningProgress: 0,
    combiningMessage: "",
    runSceneVideo: vi.fn(),
    combineVideos: vi.fn(),
    ...overrides,
  };
}

function renderStep(options: {
  scenes: Scene[];
  finalVideoUrl?: string | null;
  combinedFromThisSession?: boolean;
  getVideoUrl?: () => string | null;
}) {
  mockedQueue.mockReturnValue({
    ...queueState({ finalVideoUrl: options.finalVideoUrl ?? null }),
    ...(options.combinedFromThisSession !== undefined
      ? { combinedFromThisSession: options.combinedFromThisSession }
      : {}),
  } as ReturnType<typeof useYouTubeRenderQueue>);
  return render(
    <RenderStep
      renderTaskId={null}
      renderStatus={null}
      renderProgress={0}
      resolution="720p"
      combineScenes={options.scenes.length >= 2}
      enabledScenesCount={options.scenes.length}
      costEstimate={null}
      loadingCostEstimate={false}
      loading={false}
      scenes={options.scenes}
      videoPlan={null}
      onResolutionChange={vi.fn()}
      onCombineScenesChange={vi.fn()}
      onStartRender={vi.fn()}
      onBack={vi.fn()}
      onReset={vi.fn()}
      onRetryFailedScenes={vi.fn()}
      onScenesUpdate={vi.fn()}
      getVideoUrl={options.getVideoUrl ?? (() => null)}
    />,
  );
}

describe("RenderStep this-draft publish video", () => {
  beforeEach(() => {
    mockedQueue.mockReset();
  });

  it("publishes the new scene 1 clip instead of a rescued combined URL", () => {
    renderStep({
      scenes: [clip(1, SCENE_1), clip(2)],
      finalVideoUrl: RESCUED_COMBINED,
      getVideoUrl: () => LEFTOVER_RENDER,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(SCENE_1);
    expect(screen.getByTestId("youtube-publish-line").textContent).toBe(
      "Publishing: scene 1 clip",
    );
    expect(screen.getByTestId("youtube-publish-helper").textContent).toBe("");
  });

  it("ignores leftover getVideoUrl / renderStatus when this draft has one ready clip", () => {
    renderStep({
      scenes: [clip(1, SCENE_1)],
      finalVideoUrl: null,
      getVideoUrl: () => LEFTOVER_RENDER,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(SCENE_1);
    expect(screen.getByTestId("youtube-publish-line").textContent).toBe(
      "Publishing: scene 1 clip",
    );
  });

  it("does not pass the first scene clip when two clips are ready and Combine has not run", () => {
    renderStep({
      scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
      finalVideoUrl: null,
      getVideoUrl: () => LEFTOVER_RENDER,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe("");
    expect(screen.getByTestId("youtube-publish-helper").textContent).toBe(
      "Combine these scenes first.",
    );
    expect(screen.getByTestId("youtube-publish-line").textContent).toBe("");
  });

  it("does not use a rescued combined URL when two clips are ready and Combine has not run", () => {
    renderStep({
      scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
      finalVideoUrl: RESCUED_COMBINED,
      combinedFromThisSession: false,
      getVideoUrl: () => null,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe("");
    expect(screen.getByTestId("youtube-publish-helper").textContent).toBe(
      "Combine these scenes first.",
    );
  });

  it("publishes this-session combined output after Combine", () => {
    renderStep({
      scenes: [clip(1, SCENE_1), clip(2, SCENE_2)],
      finalVideoUrl: SESSION_COMBINED,
      combinedFromThisSession: true,
      getVideoUrl: () => LEFTOVER_RENDER,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(SESSION_COMBINED);
    expect(screen.getByTestId("youtube-publish-line").textContent).toBe(
      "Publishing: combined video",
    );
    expect(screen.getByTestId("youtube-publish-helper").textContent).toBe("");
  });
});
