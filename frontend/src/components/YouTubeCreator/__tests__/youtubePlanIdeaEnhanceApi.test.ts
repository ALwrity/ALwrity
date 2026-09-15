/**
 * Plan idea enhance API client — POST /api/youtube/plan/idea/enhance.
 */
import { youtubeApi } from "../../../services/youtubeApi";
import { longRunningApiClient } from "../../../api/client";
import { parseYouTubePlanIdeaEnhanceResponse } from "../../../services/youtubePlanIdeaEnhanceApi";

vi.mock("../../../api/client", () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
  aiApiClient: { post: vi.fn(), get: vi.fn() },
  longRunningApiClient: { post: vi.fn(), get: vi.fn() },
}));

describe("youtubeApi.enhancePlanIdea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts to /api/youtube/plan/idea/enhance", async () => {
    vi.mocked(longRunningApiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        enhanced_ideas: ["One", "Two", "Three"],
        rationales: ["A", "B", "C"],
        message: "ok",
      },
    });
    const result = await youtubeApi.enhancePlanIdea({
      user_idea: "Budget travel",
      duration_type: "shorts",
      language: "en",
    });
    expect(longRunningApiClient.post).toHaveBeenCalledWith("/api/youtube/plan/idea/enhance", {
      user_idea: "Budget travel",
      duration_type: "shorts",
      language: "en",
    });
    expect(result.enhanced_ideas).toEqual(["One", "Two", "Three"]);
  });

  it("rejects a response that is not exactly three ideas", () => {
    expect(() =>
      parseYouTubePlanIdeaEnhanceResponse({
        success: true,
        enhanced_ideas: ["One", "Two"],
        rationales: ["A", "B"],
      }),
    ).toThrow(/exactly 3/i);
  });

  it("maps a string API detail without treating FastAPI arrays as a message", async () => {
    vi.mocked(longRunningApiClient.post).mockRejectedValueOnce({
      response: { data: { detail: "Please enter your video idea." } },
    });
    await expect(
      youtubeApi.enhancePlanIdea({ user_idea: "Budget travel" }),
    ).rejects.toThrow("Please enter your video idea.");

    vi.mocked(longRunningApiClient.post).mockRejectedValueOnce({
      response: { data: { detail: [{ msg: "invalid" }] } },
    });
    await expect(
      youtubeApi.enhancePlanIdea({ user_idea: "Budget travel" }),
    ).rejects.toThrow("Could not enhance this topic. Please try again.");
  });
});
