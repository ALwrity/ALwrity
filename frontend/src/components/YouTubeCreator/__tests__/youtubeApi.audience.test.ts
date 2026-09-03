/**
 * TDD: youtubeApi.startPublish must post Made for Kids and age restriction
 * to /api/youtube/publish. Omitting the new fields must not send an 18+
 * rating. Hub wedge is out of scope.
 */
import { youtubeApi } from "../../../services/youtubeApi";
import { apiClient } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  aiApiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  longRunningApiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const CREATOR_VIDEO_URL = "/api/youtube/videos/final.mp4";

type StartPublishAudienceParams = Parameters<typeof youtubeApi.startPublish>[0] & {
  age_restricted?: boolean;
};

describe("youtubeApi.startPublish audience fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, task_id: "task-1", message: "started" },
    });
  });

  it("posts made_for_kids true to /api/youtube/publish", async () => {
    await youtubeApi.startPublish({
      token_id: 42,
      video_source: CREATOR_VIDEO_URL,
      title: "Rank Videos in 7 Days",
      made_for_kids: true,
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/youtube/publish",
      expect.objectContaining({
        token_id: 42,
        video_source: CREATOR_VIDEO_URL,
        made_for_kids: true,
      }),
    );
  });

  it("posts age_restricted true to /api/youtube/publish", async () => {
    await youtubeApi.startPublish({
      token_id: 42,
      video_source: CREATOR_VIDEO_URL,
      title: "Rank Videos in 7 Days",
      made_for_kids: false,
      age_restricted: true,
    } as StartPublishAudienceParams);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/youtube/publish",
      expect.objectContaining({
        made_for_kids: false,
        age_restricted: true,
      }),
    );
  });

  it("legacy startPublish without age_restricted does not send an 18+ rating", async () => {
    await youtubeApi.startPublish({
      token_id: 42,
      video_source: CREATOR_VIDEO_URL,
      title: "Rank Videos in 7 Days",
      made_for_kids: false,
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as StartPublishAudienceParams;
    expect(body.made_for_kids).toBe(false);
    expect(body.age_restricted).not.toBe(true);
  });
});
