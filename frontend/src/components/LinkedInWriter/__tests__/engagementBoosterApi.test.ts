import {
  optimizeForEngagement,
  scoreDraftPair,
} from "../components/dashboard/engagementBoosterApi";
import { linkedInWriterApi } from "../../../services/linkedInWriterApi";
import { linkedInGrowthApi } from "../../../services/linkedInGrowthApi";

jest.mock("../../../services/linkedInWriterApi", () => ({
  linkedInWriterApi: {
    editContent: jest.fn(),
  },
}));

jest.mock("../../../services/linkedInGrowthApi", () => ({
  linkedInGrowthApi: {
    getPostPreviewScore: jest.fn(),
  },
}));

describe("engagementBoosterApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("optimizeForEngagement", () => {
    it("returns content when API succeeds", async () => {
      (linkedInWriterApi.editContent as jest.Mock).mockResolvedValue({
        success: true,
        content: "  Rewritten post  ",
      });

      const result = await optimizeForEngagement("Original");
      expect(result).toEqual({ success: true, content: "Rewritten post" });
    });

    it("returns error when API reports failure", async () => {
      (linkedInWriterApi.editContent as jest.Mock).mockResolvedValue({
        success: false,
        error: "Authentication required",
      });

      const result = await optimizeForEngagement("Original");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("returns error when content is empty", async () => {
      (linkedInWriterApi.editContent as jest.Mock).mockResolvedValue({
        success: true,
        content: "   ",
      });

      const result = await optimizeForEngagement("Original");
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("passes persona and content-type context to the API", async () => {
      (linkedInWriterApi.editContent as jest.Mock).mockResolvedValue({
        success: true,
        content: "Rewritten",
      });

      await optimizeForEngagement("Original", {
        industry: "SaaS",
        tone: "Conversational",
        target_audience: "Founders",
        contentType: "article",
      });

      expect(linkedInWriterApi.editContent).toHaveBeenCalledWith({
        content: "Original",
        edit_type: "optimize_engagement",
        industry: "SaaS",
        tone: "Conversational",
        target_audience: "Founders",
        parameters: { content_type: "article" },
      });
    });
  });

  describe("scoreDraftPair", () => {
    it("returns scores when both calls succeed", async () => {
      (linkedInGrowthApi.getPostPreviewScore as jest.Mock)
        .mockResolvedValueOnce({ overall_score: 60 })
        .mockResolvedValueOnce({ overall_score: 80 });

      const result = await scoreDraftPair("before", "after");
      expect(result.scoringAvailable).toBe(true);
      expect(result.original?.overall_score).toBe(60);
      expect(result.optimised?.overall_score).toBe(80);
    });

    it("marks scoring unavailable when both calls fail", async () => {
      (linkedInGrowthApi.getPostPreviewScore as jest.Mock).mockRejectedValue(
        new Error("network"),
      );

      const result = await scoreDraftPair("before", "after");
      expect(result.scoringAvailable).toBe(false);
      expect(result.original).toBeNull();
      expect(result.optimised).toBeNull();
    });
  });
});
