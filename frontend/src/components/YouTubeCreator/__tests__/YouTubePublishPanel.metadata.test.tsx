/**
 * Publish must send edited combined-video metadata, not hardcoded tags.
 * Stays red until YouTubePublishPanel accepts a metadata prop.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubePublishPanel } from "../components/YouTubePublishPanel";
import { useYouTubePublish } from "../../../hooks/useYouTubePublish";
import type { YouTubePublishMetadata } from "../components/youtubePublishMetadata";

vi.mock("../../../hooks/useYouTubePublish");

const mockedUseYouTubePublish = vi.mocked(useYouTubePublish);
const CREATOR_VIDEO_URL = "/api/youtube/videos/final.mp4";

const editedMetadata: YouTubePublishMetadata = {
  title: "Edited publish title",
  description: "Edited publish description",
  tags: ["seo", "ranking"],
  category_id: "27",
};

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
  seo_keywords: ["youtube seo", "retention"],
  duration_type: "medium",
  selected_title: "Rank Videos in 7 Days",
};

function connectedHook(
  publishToYouTube: ReturnType<typeof vi.fn>,
): ReturnType<typeof useYouTubePublish> {
  const activeChannel = {
    token_id: 99,
    channel_id: "abc123",
    channel_name: "ALwrity Channel",
    expires_at: "2027-01-01T00:00:00Z",
    connected_at: "2026-01-01T00:00:00Z",
    is_active: true,
  };
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

type PublishPanelMetadataProps = React.ComponentProps<typeof YouTubePublishPanel> & {
  metadata?: YouTubePublishMetadata;
};

function renderPublishPanel(metadata: YouTubePublishMetadata) {
  const Panel = YouTubePublishPanel as unknown as React.FC<PublishPanelMetadataProps>;
  return render(
    <Panel
      videoUrl={CREATOR_VIDEO_URL}
      scenes={baseScenes}
      videoPlan={basePlan}
      metadata={metadata}
    />,
  );
}

describe("YouTubePublishPanel edited metadata", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("sends edited title, description, tags, and category_id", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel(editedMetadata);
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledTimes(1);
    expect(publishToYouTube).toHaveBeenCalledWith(CREATOR_VIDEO_URL, "Edited publish title", {
      description: "Edited publish description",
      tags: ["seo", "ranking"],
      category_id: "27",
      privacy_status: "unlisted",
      publish_at: undefined,
    });
  });

  it("still forces private when a schedule time is set", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel(editedMetadata);

    fireEvent.change(screen.getByLabelText(/Schedule/i), {
      target: { value: "2026-08-20T15:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule on YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Edited publish title",
      expect.objectContaining({
        privacy_status: "private",
        category_id: "27",
        tags: ["seo", "ranking"],
        publish_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      }),
    );
  });
});
