/**
 * TDD: useYouTubePublish must forward Made for Kids and age restriction to
 * startPublish. Legacy callers that omit the new fields still send
 * made_for_kids false and no 18+ rating. Hub wedge is out of scope.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useYouTubePublish } from "../../../hooks/useYouTubePublish";
import { youtubeApi } from "../../../services/youtubeApi";

vi.mock("../../../services/youtubeApi", () => ({
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

type AudiencePublishOptions = {
  description?: string;
  tags?: string[];
  privacy_status?: string;
  category_id?: string;
  made_for_kids?: boolean;
  age_restricted?: boolean;
  publish_at?: string;
};

async function hookUntilIdle() {
  const rendered = renderHook(() => useYouTubePublish());
  await waitFor(() => {
    expect(rendered.result.current.loading).toBe(false);
  });
  return rendered;
}

describe("useYouTubePublish audience options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(youtubeApi.getYouTubeStatus).mockResolvedValue(connectedStatus);
    vi.mocked(youtubeApi.startPublish).mockResolvedValue({
      success: true,
      task_id: "task-audience",
      message: "Publishing to YouTube started.",
    });
    vi.mocked(youtubeApi.getPublishStatus).mockResolvedValue({
      success: false,
      message: "Uploading to YouTube...",
    });
  });

  it("sends made_for_kids true to startPublish when the caller sets it", async () => {
    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(
        CREATOR_VIDEO_URL,
        "Rank Videos in 7 Days",
        { made_for_kids: true } as AudiencePublishOptions,
      );
    });

    expect(youtubeApi.startPublish).toHaveBeenCalledTimes(1);
    expect(youtubeApi.startPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        token_id: 42,
        video_source: CREATOR_VIDEO_URL,
        made_for_kids: true,
      }),
    );
  });

  it("sends age_restricted true to startPublish when the caller sets it", async () => {
    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(
        CREATOR_VIDEO_URL,
        "Rank Videos in 7 Days",
        { made_for_kids: false, age_restricted: true } as AudiencePublishOptions,
      );
    });

    expect(youtubeApi.startPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        made_for_kids: false,
        age_restricted: true,
      }),
    );
  });

  it("legacy callers without audience options still send made_for_kids false and no 18+ rating", async () => {
    const { result } = await hookUntilIdle();

    await act(async () => {
      await result.current.publishToYouTube(CREATOR_VIDEO_URL, "Rank Videos in 7 Days", {
        description: "Use searchable titles.",
        tags: ["alwrity", "youtube", "ai-video"],
        privacy_status: "unlisted",
      });
    });

    expect(youtubeApi.startPublish).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(youtubeApi.startPublish).mock.calls[0][0];
    expect(payload.made_for_kids).toBe(false);
    expect(
      (payload as AudiencePublishOptions).age_restricted,
    ).not.toBe(true);
  });
});
