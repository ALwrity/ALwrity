/**
 * Plan Your Video (Phase 0): plan/scene hook no longer calls createPlan.
 * Hook test — Jest + renderHook (TESTING.md).
 */

import { renderHook } from "@testing-library/react";
import { youtubeApi } from "../../../services/youtubeApi";
import { useYouTubePlanAndSceneHandlers } from "../panel/useYouTubePlanAndSceneHandlers";

jest.mock("../../../services/youtubeApi", () => ({
  youtubeApi: {
    createPlan: jest.fn(),
    uploadAvatar: jest.fn(),
    regenerateCreatorAvatar: jest.fn(),
    makeAvatarPresentable: jest.fn(),
    buildScenes: jest.fn(),
    updateScene: jest.fn(),
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
    updateState: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    setSuccess: jest.fn(),
    setActiveStep: jest.fn(),
    setUploadingAvatar: jest.fn(),
    setMakingPresentable: jest.fn(),
    setRegeneratingAvatar: jest.fn(),
  };
}

describe("useYouTubePlanAndSceneHandlers Phase 0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
