/**
 * TDD: Publish shows this-draft source (kind only) and stays disabled until Combine
 * when two or more scene clips are ready.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishPanel } from "../components/YouTubePublishPanel";
import { useYouTubePublish } from "../../../hooks/useYouTubePublish";

vi.mock("../../../hooks/useYouTubePublish");

const mockedUseYouTubePublish = vi.mocked(useYouTubePublish);
const SCENE_1 = "/api/youtube/videos/scene_1_new.mp4";
const SESSION_COMBINED = "/api/youtube/videos/combined_this_session.mp4";

const activeChannel = {
  token_id: 99,
  channel_id: "abc123",
  channel_name: "ALwrity Channel",
  expires_at: "2027-01-01T00:00:00Z",
  connected_at: "2026-01-01T00:00:00Z",
  is_active: true,
};

const baseScenes = [
  {
    scene_number: 1,
    title: "Intro",
    narration: "Narration",
    visual_prompt: "Visual",
    duration_estimate: 5,
    visual_cues: [] as string[],
    emphasis_tags: [] as string[],
  },
];

const basePlan = {
  video_summary: "How to rank YouTube videos fast",
  target_audience: "Creators",
  key_message: "Use searchable titles and retention hooks.",
  content_outline: [] as [],
  hook_strategy: "Hook",
  visual_style: "Modern",
  seo_keywords: ["youtube seo"],
  duration_type: "medium",
};

function connectedHook(publishToYouTube = vi.fn()): ReturnType<typeof useYouTubePublish> {
  return {
    connected: true,
    channels: [activeChannel],
    loading: false,
    error: null,
    activeChannel,
    connect: vi.fn(),
    disconnect: vi.fn(),
    checkStatus: vi.fn(),
    publishState: {
      publishing: false,
      taskId: null,
      videoUrl: null,
      videoId: null,
      progress: "",
      error: null,
    },
    publishToYouTube,
    resetPublishState: vi.fn(),
  };
}

type DraftPublishProps = React.ComponentProps<typeof YouTubePublishPanel> & {
  publishLine?: string | null;
  helperText?: string | null;
};

function chooseNotMadeForKids() {
  fireEvent.click(
    screen.getByRole("radio", { name: /no, it's not ['"]?made for kids['"]?/i }),
  );
}

function renderPanel(props: Partial<DraftPublishProps> = {}) {
  const Panel = YouTubePublishPanel as unknown as React.FC<DraftPublishProps>;
  return render(
    <Panel
      videoUrl={props.videoUrl ?? null}
      scenes={baseScenes}
      videoPlan={basePlan}
      publishLine={props.publishLine}
      helperText={props.helperText}
    />,
  );
}

describe("YouTubePublishPanel this-draft source copy", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("shows Publishing: scene 1 clip without the file path", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedHook());
    renderPanel({
      videoUrl: SCENE_1,
      publishLine: "Publishing: scene 1 clip",
    });

    expect(screen.getByText("Publishing: scene 1 clip")).not.toBeNull();
    expect(screen.queryByText(SCENE_1)).toBeNull();
    expect(screen.queryByText(/scene_1_new\.mp4/i)).toBeNull();
  });

  it("shows Publishing: combined video without the file path", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedHook());
    renderPanel({
      videoUrl: SESSION_COMBINED,
      publishLine: "Publishing: combined video",
    });

    expect(screen.getByText("Publishing: combined video")).not.toBeNull();
    expect(screen.queryByText(SESSION_COMBINED)).toBeNull();
  });

  it("disables Publish and tells the user to combine when two clips are ready", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPanel({
      videoUrl: null,
      helperText: "Combine these scenes first.",
    });

    expect(screen.getByText("Combine these scenes first.")).not.toBeNull();
    expect(screen.queryByText(/Complete final video rendering first/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Publish to YouTube" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));
    expect(publishToYouTube).not.toHaveBeenCalled();
  });

  it("publishes the provided this-draft URL for a single scene clip", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPanel({
      videoUrl: SCENE_1,
      publishLine: "Publishing: scene 1 clip",
    });
    chooseNotMadeForKids();

    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));
    expect(publishToYouTube).toHaveBeenCalledTimes(1);
    expect(publishToYouTube.mock.calls[0][0]).toBe(SCENE_1);
  });
});
