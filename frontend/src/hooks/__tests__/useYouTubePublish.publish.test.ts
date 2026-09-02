/**
 * useYouTubePublish — Video Creator publish start + status poll.
 * Does not cover Hub Publish wedge or Podcast Maker.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useYouTubePublish } from "../useYouTubePublish";
import { youtubeApi } from "../../services/youtubeApi";

vi.mock("../../services/youtubeApi", () => ({
  youtubeApi: {
    getYouTubeStatus: vi.fn(),
    getYouTubeAuthUrl: vi.fn(),
    disconnectYouTube: vi.fn(),
    startPublish: vi.fn(),
    getPublishStatus: vi.fn(),
  },
}));

const CREATOR_VIDEO_URL = "/api/youtube/videos/final.mp4";

const connectedChannel = {
  token_id: 42,
  channel_id: "UCabc",
  channel_name: "Studio Channel",
  expires_at: "2027-01-01T00:00:00Z",
  connected_at: "2026-01-01T00:00:00Z",
  is_active: true,
};

const connectedStatus = {
  success: true,
  connected: true,
  channels: [connectedChannel],
};

const disconnectedStatus = {
  success: true,
  connected: false,
  channels: [],
};

async function hookUntilIdle() {
  const rendered = renderHook(() => useYouTubePublish());
  await waitFor(() => {
    expect(rendered.result.current.loading).toBe(false);
  });
  return rendered;
}

describe("useYouTubePublish startPublish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(connectedStatus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call startPublish when no active channel is connected", async () => {
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(disconnectedStatus);
    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "My video");
    });

    expect(youtubeApi.startPublish).not.toHaveBeenCalled();
    expect(result.current.publishState.error).toMatch(/no active YouTube channel/i);
    expect(result.current.publishState.publishing).toBe(false);
  });

  it("calls startPublish with the Creator video path and active token_id", async () => {
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: true,
      task_id: "task-1",
      message: "Publishing to YouTube started.",
    });
    vi.mocked(youtubeApi.getPublishStatus).mockResolvedValue({
      success: false,
      message: "Uploading to YouTube...",
    });

    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "Rank Videos in 7 Days", {
        description: "Use searchable titles.",
        tags: ["alwrity", "youtube", "ai-video"],
        privacy_status: "unlisted",
      });
    });

    expect(youtubeApi.startPublish).toHaveBeenCalledTimes(1);
    expect(youtubeApi.startPublish).toHaveBeenCalledWith({
      token_id: 42,
      video_source: CREATOR_VIDEO_URL,
      title: "Rank Videos in 7 Days",
      description: "Use searchable titles.",
      tags: ["alwrity", "youtube", "ai-video"],
      privacy_status: "unlisted",
      category_id: "22",
      made_for_kids: false,
      publish_at: undefined,
    });
    expect(result.current.publishState.publishing).toBe(true);
    expect(result.current.publishState.taskId).toBe("task-1");
    expect(result.current.publishState.error).toBeNull();
  });

  it("stops without polling when startPublish returns no task_id", async () => {
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: false,
      error: "Invalid or inactive token_id",
      message: "Failed",
    });

    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "My video");
    });

    expect(youtubeApi.getPublishStatus).not.toHaveBeenCalled();
    expect(result.current.publishState.publishing).toBe(false);
    expect(result.current.publishState.error).toBe("Invalid or inactive token_id");
  });
});

async function advancePublishPoll(times = 1) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000 * times);
  });
}

describe("useYouTubePublish poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(connectedStatus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps waiting when the poll has no video_url and no error", async () => {
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: true,
      task_id: "task-wait",
      message: "started",
    });
    vi.mocked(youtubeApi.getPublishStatus).mockResolvedValue({
      success: false,
      task_id: "task-wait",
      message: "Uploading to YouTube...",
    });

    const { result, unmount } = await hookUntilIdle();
    vi.useFakeTimers();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "My video");
    });
    await advancePublishPoll();

    expect(youtubeApi.getPublishStatus).toHaveBeenCalledWith("task-wait");
    expect(result.current.publishState.publishing).toBe(true);
    expect(result.current.publishState.videoUrl).toBeNull();
    expect(result.current.publishState.error).toBeNull();
    expect(result.current.publishState.progress).toBe("Uploading to YouTube...");
    unmount();
  });

  it("stops polling and stores the YouTube URL when the task completes", async () => {
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: true,
      task_id: "task-done",
      message: "started",
    });
    vi.mocked(youtubeApi.getPublishStatus)
      .mockResolvedValueOnce({
        success: false,
        task_id: "task-done",
        message: "Uploading to YouTube...",
      })
      .mockResolvedValueOnce({
        success: true,
        task_id: "task-done",
        video_id: "abc123",
        video_url: "https://youtu.be/abc123",
        message: "Published successfully",
      });

    const { result, unmount } = await hookUntilIdle();
    vi.useFakeTimers();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "My video");
    });
    await advancePublishPoll();
    expect(result.current.publishState.publishing).toBe(true);

    await advancePublishPoll();
    expect(result.current.publishState.publishing).toBe(false);
    expect(result.current.publishState.videoUrl).toBe("https://youtu.be/abc123");
    expect(result.current.publishState.videoId).toBe("abc123");
    expect(result.current.publishState.error).toBeNull();
    unmount();
  });

  it("stops polling and surfaces the error when the task fails", async () => {
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: true,
      task_id: "task-fail",
      message: "started",
    });
    vi.mocked(youtubeApi.getPublishStatus).mockResolvedValue({
      success: false,
      task_id: "task-fail",
      error: "Video source file not found or could not be downloaded.",
      message: "Publish failed",
    });

    const { result, unmount } = await hookUntilIdle();
    vi.useFakeTimers();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "My video");
    });
    await advancePublishPoll();

    expect(result.current.publishState.publishing).toBe(false);
    expect(result.current.publishState.videoUrl).toBeNull();
    expect(result.current.publishState.error).toBe(
      "Video source file not found or could not be downloaded.",
    );
    unmount();
  });
});
