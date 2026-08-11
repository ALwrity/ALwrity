import { youtubeApi } from "../youtubeApi";
import { apiClient } from "../../api/client";

jest.mock("../../api/client", () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  aiApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock("../../utils/apiUrl", () => ({
  getApiBaseUrl: () => "http://localhost:8000",
}));

describe("youtubeApi async planning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("createPlanTask posts to /api/youtube/plan", async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, task_id: "plan-task-1", message: "started" },
    });

    const payload = {
      user_idea: "Build a YouTube shorts plan",
      duration_type: "shorts" as const,
    };
    const result = await youtubeApi.createPlanTask(payload);

    expect(result.success).toBe(true);
    expect(result.task_id).toBe("plan-task-1");
    expect(apiClient.post).toHaveBeenCalledWith("/api/youtube/plan", payload);
  });

  it("getPlanStatus returns null when backend returns null", async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ data: null });
    const result = await youtubeApi.getPlanStatus("missing-task");
    expect(result).toBeNull();
  });

  it("getPlanStatus returns null on 404", async () => {
    jest.mocked(apiClient.get).mockRejectedValue({
      response: { status: 404 },
    });
    const result = await youtubeApi.getPlanStatus("missing-task");
    expect(result).toBeNull();
  });
});

