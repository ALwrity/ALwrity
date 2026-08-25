/**
 * Plan Your Video (Phase 0): plan/scene hook no longer calls createPlan.
 * Hook test — Jest + renderHook (TESTING.md).
 */

import { renderHook } from "@testing-library/react";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubePlanAndSceneHandlers } from "../panel/useYouTubePlanAndSceneHandlers";

vi.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    createPlan: vi.fn(),
    uploadAvatar: vi.fn(),
    regenerateCreatorAvatar: vi.fn(),
    makeAvatarPresentable: vi.fn(),
    buildScenes: vi.fn(),
    updateScene: vi.fn(),
  },
}));

function buildArgs() {
  return {
    videoType: "" as const,
    targetAudience: "",
    videoGoal: "",
    brandStyle: "",
    avatarUrl: null,
    videoPlan: null,
    scenes: [],
    editingSceneId: null,
    editedScene: null,
    makingPresentable: false,
    fullScript: null,
    updateState: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setSuccess: vi.fn(),
    setActiveStep: vi.fn(),
    setUploadingAvatar: vi.fn(),
    setMakingPresentable: vi.fn(),
    setRegeneratingAvatar: vi.fn(),
  };
}

describe("useYouTubePlanAndSceneHandlers Phase 0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose handleGeneratePlan and never calls createPlan", () => {
    const { result } = renderHook(() => useYouTubePlanAndSceneHandlers(buildArgs()));

    expect(result.current).not.toHaveProperty("handleGeneratePlan");
    expect(youtubeApi.createPlan).not.toHaveBeenCalled();
    expect(typeof result.current.handleBuildScenes).toBe("function");
    expect(typeof result.current.handleLanguageChange).toBe("function");
  });

  it("applies a known language and Hindi boost without throwing", () => {
    const args = buildArgs();
    const { result } = renderHook(() => useYouTubePlanAndSceneHandlers(args));

    result.current.handleLanguageChange("hi");

    expect(args.updateState).toHaveBeenCalledWith({
      language: "hi",
      languageBoost: "Hindi",
    });
    expect(args.setError).not.toHaveBeenCalled();
  });
});
