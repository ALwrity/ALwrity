/**
 * TDD: Connect & Publish must collect YouTube audience (Made for Kids) and
 * Age restriction (advanced) before upload. Stays red until the panel shows
 * those controls, requires a kids Yes/No choice, and disables 18+ when kids
 * is Yes. Hub Publish wedge and Podcast Maker are out of scope.
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

function renderPublishPanel() {
  return render(
    <YouTubePublishPanel
      videoUrl={CREATOR_VIDEO_URL}
      scenes={baseScenes}
      videoPlan={basePlan}
      metadata={editedMetadata}
    />,
  );
}

function kidsYesRadio() {
  return screen.getByRole("radio", { name: /yes, it's made for kids/i });
}

function kidsNoRadio() {
  return screen.getByRole("radio", { name: /no, it's not ['"]?made for kids['"]?/i });
}

function ageRestrictYesRadio() {
  return screen.getByRole("radio", {
    name: /yes, restrict my video to viewers over 18/i,
  });
}

describe("YouTubePublishPanel audience (Made for Kids + age restriction)", () => {
  beforeEach(() => {
    mockedUseYouTubePublish.mockReset();
  });

  it("shows Made for Kids Yes/No and Age restriction (advanced)", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedHook(vi.fn()));
    renderPublishPanel();

    expect(kidsYesRadio()).toBeTruthy();
    expect(kidsNoRadio()).toBeTruthy();
    expect(screen.getByText(/age restriction \(advanced\)/i)).toBeTruthy();
    expect(ageRestrictYesRadio()).toBeTruthy();
  });

  it("keeps Publish disabled until Made for Kids is chosen", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel();

    const publishButton = screen.getByRole("button", { name: "Publish to YouTube" });
    expect(publishButton).toBeDisabled();
    fireEvent.click(publishButton);
    expect(publishToYouTube).not.toHaveBeenCalled();

    fireEvent.click(kidsNoRadio());
    expect(screen.getByRole("button", { name: "Publish to YouTube" })).toBeEnabled();
  });

  it("sends made_for_kids true when Yes, it's made for kids is selected", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel();

    fireEvent.click(kidsYesRadio());
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledTimes(1);
    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Edited publish title",
      expect.objectContaining({
        made_for_kids: true,
      }),
    );
    expect(publishToYouTube.mock.calls[0][2].age_restricted).not.toBe(true);
  });

  it("sends made_for_kids false when No, it's not made for kids is selected", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel();

    fireEvent.click(kidsNoRadio());
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Edited publish title",
      expect.objectContaining({
        made_for_kids: false,
      }),
    );
    expect(publishToYouTube.mock.calls[0][2].age_restricted).not.toBe(true);
  });

  it("disables 18+ restriction when Made for Kids is Yes", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedHook(vi.fn()));
    renderPublishPanel();

    fireEvent.click(kidsYesRadio());
    expect(ageRestrictYesRadio()).toBeDisabled();
  });

  it("enables 18+ restriction after No, it's not made for kids", () => {
    mockedUseYouTubePublish.mockReturnValue(connectedHook(vi.fn()));
    renderPublishPanel();

    fireEvent.click(kidsNoRadio());
    expect(ageRestrictYesRadio()).toBeEnabled();
  });

  it("sends age_restricted true only with not-made-for-kids", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel();

    fireEvent.click(kidsNoRadio());
    fireEvent.click(ageRestrictYesRadio());
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Edited publish title",
      expect.objectContaining({
        made_for_kids: false,
        age_restricted: true,
      }),
    );
  });

  it("clears 18+ when the user switches to Made for Kids Yes", () => {
    const publishToYouTube = vi.fn();
    mockedUseYouTubePublish.mockReturnValue(connectedHook(publishToYouTube));
    renderPublishPanel();

    fireEvent.click(kidsNoRadio());
    fireEvent.click(ageRestrictYesRadio());
    fireEvent.click(kidsYesRadio());
    expect(ageRestrictYesRadio()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Publish to YouTube" }));

    expect(publishToYouTube).toHaveBeenCalledWith(
      CREATOR_VIDEO_URL,
      "Edited publish title",
      expect.objectContaining({
        made_for_kids: true,
      }),
    );
    expect(publishToYouTube.mock.calls[0][2].age_restricted).not.toBe(true);
  });
});
