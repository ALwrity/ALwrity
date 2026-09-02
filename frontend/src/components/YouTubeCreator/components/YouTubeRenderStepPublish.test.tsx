/**
 * Video Creator Render step must pass the /api/youtube/videos/... URL
 * into YouTubePublishPanel. Hub wedge and Podcast Maker are out of scope.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { RenderStep } from "./RenderStep";
import { useYouTubeRenderQueue } from "../hooks/useYouTubeRenderQueue";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock("../hooks/useYouTubeRenderQueue");
vi.mock("./CombinedSceneOverview", () => ({ CombinedSceneOverview: () => null }));
vi.mock("./CostEstimateCard", () => ({ CostEstimateCard: () => null }));
vi.mock("./RenderSettings", () => ({ RenderSettings: () => null }));
vi.mock("./RenderStatusDisplay", () => ({ RenderStatusDisplay: () => null }));
vi.mock("./YouTubeFinalVideoPanel", () => ({ YouTubeFinalVideoPanel: () => null }));
vi.mock("./YouTubeSceneVideoPromptPanel", () => ({
  YouTubeSceneVideoPromptPanel: () => null,
}));
vi.mock("./SceneVideoActions", () => ({ SceneVideoActions: () => null }));
vi.mock("./ScenePreviewModal", () => ({ ScenePreviewModal: () => null }));
vi.mock("./YouTubePublishMetadataFields", () => ({
  YouTubePublishMetadataFields: () => null,
}));
vi.mock("./YouTubePublishPanel", () => ({
  YouTubePublishPanel: ({ videoUrl }: { videoUrl: string | null }) => (
    <div data-testid="youtube-publish-video-url">{videoUrl ?? ""}</div>
  ),
}));

const mockedQueue = vi.mocked(useYouTubeRenderQueue);

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

function renderStep(
  overrides: {
    finalVideoUrl?: string | null;
    combinedFromThisSession?: boolean;
    getVideoUrl?: () => string | null;
  } = {},
) {
  mockedQueue.mockReturnValue(
    queueState({
      finalVideoUrl: overrides.finalVideoUrl ?? null,
      combinedFromThisSession: overrides.combinedFromThisSession ?? false,
    }),
  );

  return render(
    <RenderStep
      renderTaskId={null}
      renderStatus={null}
      renderProgress={0}
      resolution="720p"
      combineScenes={false}
      enabledScenesCount={0}
      costEstimate={null}
      loadingCostEstimate={false}
      loading={false}
      scenes={[]}
      videoPlan={null}
      onResolutionChange={vi.fn()}
      onCombineScenesChange={vi.fn()}
      onStartRender={vi.fn()}
      onBack={vi.fn()}
      onReset={vi.fn()}
      onRetryFailedScenes={vi.fn()}
      onScenesUpdate={vi.fn()}
      getVideoUrl={overrides.getVideoUrl ?? (() => null)}
    />,
  );
}

describe("RenderStep YouTube publish video URL", () => {
  beforeEach(() => {
    mockedQueue.mockReset();
  });

  it("passes this-session combined Creator URL to the publish panel", () => {
    renderStep({
      finalVideoUrl: "/api/youtube/videos/final.mp4",
      combinedFromThisSession: true,
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(
      "/api/youtube/videos/final.mp4",
    );
  });

  it("does not publish leftover getVideoUrl when this draft has no clip", () => {
    renderStep({
      finalVideoUrl: null,
      getVideoUrl: () => "/api/youtube/videos/scene_1_user_abc.mp4",
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe("");
  });

  it("prefers this-session combined URL over leftover getVideoUrl", () => {
    renderStep({
      finalVideoUrl: "/api/youtube/videos/final.mp4",
      combinedFromThisSession: true,
      getVideoUrl: () => "/api/youtube/videos/scene_1.mp4",
    });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe(
      "/api/youtube/videos/final.mp4",
    );
  });

  it("passes an empty URL when no Creator video is ready", () => {
    renderStep({ finalVideoUrl: null, getVideoUrl: () => null });

    expect(screen.getByTestId("youtube-publish-video-url").textContent).toBe("");
  });
});
