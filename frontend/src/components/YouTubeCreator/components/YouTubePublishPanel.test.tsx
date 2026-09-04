import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishPanel } from "./YouTubePublishPanel";
import { useYouTubePublish } from "../../../hooks/useYouTubePublish";

vi.mock("../../../hooks/useYouTubePublish");

const mockedUseYouTubePublish = vi.mocked(useYouTubePublish);

/** Video Creator Render serves files at this path, not a public https URL. */
const CREATOR_VIDEO_URL = "/api/youtube/videos/final.mp4";

const activeChannel = {
  token_id: 99,
  channel_id: "abc123",
  channel_name: "ALwrity Channel",
  expires_at: "2027-01-01T00:00:00Z",
  connected_at: "2026-01-01T00:00:00Z",
  is_active: true,
};

function buildHookState(
  overrides: Partial<ReturnType<typeof useYouTubePublish>> = {},
): ReturnType<typeof useYouTubePublish> {
  return {
    connected: false,
    channels: [],
    loading: false,
    error: null,
    activeChannel: null,
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
    publishToYouTube: vi.fn(),
    resetPublishState: vi.fn(),
    ...overrides,
  };
}

function connectedState(
  overrides: Partial<ReturnType<typeof useYouTubePublish>> = {},
): ReturnType<typeof useYouTubePublish> {
  return buildHookState({
    connected: true,
    activeChannel,
    ...overrides,
  });
}

const baseScenes = [
  {
    scene_number: 1,
    title: "Intro to YouTube SEO",
    narration: "Narration",
    visual_prompt: "Prompt",
    duration_estimate: 12,
    visual_cues: [],
    emphasis_tags: [],
  },
];

const basePlan = {
  video_summary: "How to rank YouTube videos fast",
  target_audience: "Creators",
  key_message: "Use searchable titles and retention hooks.",
  content_outline: [] as [],
  hook_strategy: "Open with a bold promise",
  visual_style: "Modern",
  seo_keywords: ["youtube seo"],
  duration_type: "medium",
};

function chooseNotMadeForKids() {
  fireEvent.click(
    screen.getByRole("radio", { name: /no, it's not ['"]?made for kids['"]?/i }),
  );
}

describe("YouTubePublishPanel connect and disconnect", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("shows Connect YouTube Account when disconnected and does not show Disconnect", () => {
    mockedUseYouTubePublish.mockReturnValue(buildHookState());

    render(<YouTubePublishPanel videoUrl={null} scenes={baseScenes} videoPlan={null} />);

    expect(screen.getByRole("button", { name: "Connect YouTube Account" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
    expect(screen.getByText(/Complete final video rendering first/i)).not.toBeNull();
  });

  it("connect button calls connect once", () => {
    const connect = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(buildHookState({ connect }));

    render(<YouTubePublishPanel videoUrl={null} scenes={baseScenes} videoPlan={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect YouTube Account" }));

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("hides connect and shows the active channel name when connected", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedState());

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={null}
      />,
    );

    expect(screen.queryByRole("button", { name: "Connect YouTube Account" })).toBeNull();
    expect(screen.getByText("Connected: ALwrity Channel")).not.toBeNull();
  });

  it("disconnect uses the active channel token_id", () => {
    const disconnect = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ disconnect }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledWith(99);
  });
});

describe("YouTubePublishPanel title, schedule, and publish", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("disables Publish when the Creator video URL is missing", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedState());

    render(<YouTubePublishPanel videoUrl={null} scenes={baseScenes} videoPlan={basePlan} />);

    expect(screen.getByRole("button", { name: "Publish to YouTube" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows a progress bar while publish is running", () => {
    mockedUseYouTubePublish.mockReturnValue(
      connectedState({
        publishState: {
          publishing: true,
          taskId: "task-1",
          videoUrl: null,
          videoId: null,
          progress: "Waiting for YouTube to finish the video...",
          error: null,
        },
      }),
    );

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );

    expect(screen.getByRole("progressbar", { name: /Publish progress/i })).toBeTruthy();
    expect(screen.getByText(/Waiting for YouTube to finish the video/i)).toBeTruthy();
  });

  it("disables Publish while an upload is in progress", () => {
    mockedUseYouTubePublish.mockReturnValue(
      connectedState({
        publishState: {
          publishing: true,
          taskId: "task-1",
          videoUrl: null,
          videoId: null,
          progress: "Uploading to YouTube...",
          error: null,
        },
      }),
    );

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );

    expect(screen.getByRole("button", { name: /Publishing/i })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("sends the Creator /api/youtube/videos path, plan title, description, tags, and unlisted", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );
    chooseNotMadeForKids();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledTimes(1);
    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "How to rank YouTube videos fast",
      {
        description: "Use searchable titles and retention hooks.",
        tags: ["alwrity", "youtube", "ai-video"],
        privacy_status: "unlisted",
        publish_at: undefined,
        made_for_kids: false,
      },
    );
  });

  it("prefers selected_title over video_summary", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={{ ...basePlan, selected_title: "Rank Videos in 7 Days" }}
      />,
    );
    chooseNotMadeForKids();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Rank Videos in 7 Days",
      expect.objectContaining({ privacy_status: "unlisted" }),
    );
  });

  it("falls back to the first scene title when the plan has no title", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={null}
      />,
    );
    chooseNotMadeForKids();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Intro to YouTube SEO",
      expect.objectContaining({
        description: "Created with ALwrity YouTube Creator",
      }),
    );
  });

  it("does not send publish_at when the schedule field is empty", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );
    chooseNotMadeForKids();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    const options = publishToYouTube.mock.calls[0][2] as { publish_at?: string };
    expect(options.publish_at).toBeUndefined();
    expect(options).toEqual(
      expect.objectContaining({ privacy_status: "unlisted" }),
    );
  });

  it("keeps Privacy selectable when scheduling and still sends private until go-live", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );
    chooseNotMadeForKids();

    fireEvent.change(screen.getByLabelText(/Schedule/i), {
      target: { value: "2026-08-20T15:00" },
    });

    const privacy = screen.getByLabelText("Privacy");
    expect(privacy).not.toHaveAttribute("aria-disabled", "true");
    expect(privacy).toHaveTextContent("Unlisted");

    fireEvent.mouseDown(privacy);
    fireEvent.click(screen.getByRole("option", { name: "Public" }));

    fireEvent.click(screen.getByRole("button", { name: "Schedule on YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledTimes(1);
    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "How to rank YouTube videos fast",
      expect.objectContaining({
        privacy_status: "private",
        publish_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      }),
    );
  });

  it("still sends private and UTC publish_at when scheduling without changing Privacy", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );
    chooseNotMadeForKids();

    fireEvent.change(screen.getByLabelText(/Schedule/i), {
      target: { value: "2026-08-20T15:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule on YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "How to rank YouTube videos fast",
      expect.objectContaining({
        privacy_status: "private",
        publish_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      }),
    );
  });

  it("sends the selected Privacy when publishing now without a schedule", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedState({ publishToYouTube }));

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );
    chooseNotMadeForKids();

    fireEvent.mouseDown(screen.getByLabelText("Privacy"));
    fireEvent.click(screen.getByRole("option", { name: "Public" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "How to rank YouTube videos fast",
      expect.objectContaining({
        privacy_status: "public",
        publish_at: undefined,
      }),
    );
  });

  it("explains that scheduled uploads stay private until go-live", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedState());

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );

    expect(screen.getByText(/Leave empty to publish now/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Schedule/i), {
      target: { value: "2026-08-20T15:00" },
    });

    expect(
      screen.getByText(/YouTube keeps this private until this time/i),
    ).toBeTruthy();
  });
});

describe("YouTubePublishPanel cover picture applied copy", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("does not claim the picture is visible on the watch page when applied", () => {
    mockedUseYouTubePublish.mockReturnValue(
      connectedState({
        publishState: {
          publishing: false,
          taskId: "task-1",
          videoUrl: "https://youtu.be/abc",
          videoId: "abc",
          progress: "Published!",
          error: null,
          thumbnailApplied: true,
        },
      }),
    );

    render(
      <YouTubePublishPanel
        videoUrl={CREATOR_VIDEO_URL}
        scenes={baseScenes}
        videoPlan={basePlan}
      />,
    );

    expect(screen.getByText(/Published successfully/i)).toBeTruthy();
    expect(screen.queryByText(/YouTube accepted the cover picture/i)).toBeNull();
    expect(screen.getByText(/We sent the cover picture to YouTube/i)).toBeTruthy();
    expect(screen.getByText(/YouTube Studio/i)).toBeTruthy();
  });
});
