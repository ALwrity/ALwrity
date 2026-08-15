import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishPanel } from "./YouTubePublishPanel";
import { useYouTubePublish } from "../../../hooks/useYouTubePublish";

jest.mock("../../../hooks/useYouTubePublish");

const mockedUseYouTubePublish = useYouTubePublish as jest.MockedFunction<typeof useYouTubePublish>;

function buildHookState(overrides: Partial<ReturnType<typeof useYouTubePublish>> = {}): ReturnType<typeof useYouTubePublish> {
  return {
    connected: false,
    channels: [],
    loading: false,
    error: null,
    activeChannel: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    checkStatus: jest.fn(),
    publishState: {
      publishing: false,
      taskId: null,
      videoUrl: null,
      videoId: null,
      progress: "",
      error: null,
    },
    publishToYouTube: jest.fn(),
    resetPublishState: jest.fn(),
    ...overrides,
  };
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

describe("YouTubePublishPanel", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("shows connect CTA when no YouTube account is connected", () => {
    mockedUseYouTubePublish.mockReturnValue(buildHookState());

    render(<YouTubePublishPanel videoUrl={null} scenes={baseScenes} videoPlan={null} />);

    expect(screen.getByRole("button", { name: "Connect YouTube Account" })).not.toBeNull();
    expect(screen.getByText(/Complete final video rendering first/i)).not.toBeNull();
  });

  it("connect button triggers OAuth connect flow", () => {
    const connect = jest.fn();
    mockedUseYouTubePublish.mockReturnValue(buildHookState({ connect }));

    render(<YouTubePublishPanel videoUrl={null} scenes={baseScenes} videoPlan={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect YouTube Account" }));

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("shows connected channel and disconnect action", () => {
    const disconnect = jest.fn();
    mockedUseYouTubePublish.mockReturnValue(
      buildHookState({
        connected: true,
        activeChannel: {
          token_id: 99,
          channel_id: "abc123",
          channel_name: "ALwrity Channel",
          expires_at: "2027-01-01T00:00:00Z",
          connected_at: "2026-01-01T00:00:00Z",
          is_active: true,
        },
        disconnect,
      }),
    );

    render(<YouTubePublishPanel videoUrl="https://example.com/video.mp4" scenes={baseScenes} videoPlan={null} />);

    expect(screen.getByText("Connected: ALwrity Channel")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledWith(99);
  });

  it("publishes with derived title and description from video plan", () => {
    const publishToYouTube = jest.fn();
    mockedUseYouTubePublish.mockReturnValue(
      buildHookState({
        connected: true,
        activeChannel: {
          token_id: 99,
          channel_id: "abc123",
          channel_name: "ALwrity Channel",
          expires_at: "2027-01-01T00:00:00Z",
          connected_at: "2026-01-01T00:00:00Z",
          is_active: true,
        },
        publishToYouTube,
      }),
    );

    render(
      <YouTubePublishPanel
        videoUrl="https://example.com/video.mp4"
        scenes={baseScenes}
        videoPlan={{
          video_summary: "How to rank YouTube videos fast",
          target_audience: "Creators",
          key_message: "Use searchable titles and retention hooks.",
          content_outline: [],
          hook_strategy: "Open with a bold promise",
          visual_style: "Modern",
          seo_keywords: ["youtube seo"],
          duration_type: "medium",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      "https://example.com/video.mp4",
      "How to rank YouTube videos fast",
      expect.objectContaining({
        description: "Use searchable titles and retention hooks.",
      }),
    );
  });

  it("publishes with selected_title when present", () => {
    const publishToYouTube = jest.fn();
    mockedUseYouTubePublish.mockReturnValue(
      buildHookState({
        connected: true,
        activeChannel: {
          token_id: 99,
          channel_id: "abc123",
          channel_name: "ALwrity Channel",
          expires_at: "2027-01-01T00:00:00Z",
          connected_at: "2026-01-01T00:00:00Z",
          is_active: true,
        },
        publishToYouTube,
      }),
    );

    render(
      <YouTubePublishPanel
        videoUrl="https://example.com/video.mp4"
        scenes={baseScenes}
        videoPlan={{
          video_summary: "How to rank YouTube videos fast",
          target_audience: "Creators",
          key_message: "Use searchable titles and retention hooks.",
          content_outline: [],
          hook_strategy: "Open with a bold promise",
          visual_style: "Modern",
          seo_keywords: ["youtube seo"],
          duration_type: "medium",
          selected_title: "Rank Videos in 7 Days",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      "https://example.com/video.mp4",
      "Rank Videos in 7 Days",
      expect.objectContaining({
        description: "Use searchable titles and retention hooks.",
      }),
    );
  });
});
