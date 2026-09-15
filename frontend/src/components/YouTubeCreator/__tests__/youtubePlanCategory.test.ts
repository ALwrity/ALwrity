/**
 * Plan Your Video category packs — Kids / Explainer fill type, audience, goal, style.
 */
import { TARGET_AUDIENCE_OPTIONS } from "../constants";
import {
  applyYouTubePlanCategoryPack,
  EMPTY_YOUTUBE_PLAN_DETAILS_TOUCHED,
  parseYouTubePlanCategory,
  YOUTUBE_PLAN_CATEGORY_PACKS,
} from "../components/youtubePlanCategory";

const EMPTY_FIELDS = {
  videoType: "" as const,
  targetAudience: "",
  videoGoal: "",
  brandStyle: "",
};

describe("youtubePlanCategory", () => {
  it("maps Kids and Explainer to the locked producer packs", () => {
    expect(YOUTUBE_PLAN_CATEGORY_PACKS.kids).toEqual({
      videoType: "storytelling",
      targetAudience: "kids_and_families",
      videoGoal: "educate",
      brandStyle: "playful_fun",
    });
    expect(YOUTUBE_PLAN_CATEGORY_PACKS.explainer).toEqual({
      videoType: "educational",
      targetAudience: "students",
      videoGoal: "educate",
      brandStyle: "modern_minimalist",
    });
    expect(TARGET_AUDIENCE_OPTIONS.some((opt) => opt.value === "kids_and_families")).toBe(true);
  });

  it("accepts kids and explainer and treats blank as unset", () => {
    expect(parseYouTubePlanCategory("kids")).toBe("kids");
    expect(parseYouTubePlanCategory("explainer")).toBe("explainer");
    expect(parseYouTubePlanCategory("")).toBe("");
    expect(parseYouTubePlanCategory(undefined)).toBe("");
    expect(parseYouTubePlanCategory(null)).toBe("");
  });

  it("warns and unsets unknown stored categories instead of inventing a pack", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseYouTubePlanCategory("fun")).toBe("");
    expect(parseYouTubePlanCategory("education")).toBe("");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fills untouched fields from the Kids pack", () => {
    const next = applyYouTubePlanCategoryPack({
      category: "kids",
      current: EMPTY_FIELDS,
      touched: EMPTY_YOUTUBE_PLAN_DETAILS_TOUCHED,
    });
    expect(next.planCategory).toBe("kids");
    expect(next.videoType).toBe("storytelling");
    expect(next.targetAudience).toBe("kids_and_families");
    expect(next.videoGoal).toBe("educate");
    expect(next.brandStyle).toBe("playful_fun");
  });

  it("fills untouched fields from the Explainer pack", () => {
    const next = applyYouTubePlanCategoryPack({
      category: "explainer",
      current: EMPTY_FIELDS,
      touched: EMPTY_YOUTUBE_PLAN_DETAILS_TOUCHED,
    });
    expect(next.planCategory).toBe("explainer");
    expect(next.videoType).toBe("educational");
    expect(next.targetAudience).toBe("students");
    expect(next.videoGoal).toBe("educate");
    expect(next.brandStyle).toBe("modern_minimalist");
  });

  it("does not overwrite a user-touched field when applying a pack", () => {
    const next = applyYouTubePlanCategoryPack({
      category: "kids",
      current: {
        videoType: "tutorial",
        targetAudience: "travelers",
        videoGoal: "sell",
        brandStyle: "luxury_premium",
      },
      touched: {
        videoType: true,
        targetAudience: false,
        videoGoal: true,
        brandStyle: false,
      },
    });
    expect(next.planCategory).toBe("kids");
    expect(next.videoType).toBe("tutorial");
    expect(next.targetAudience).toBe("kids_and_families");
    expect(next.videoGoal).toBe("sell");
    expect(next.brandStyle).toBe("playful_fun");
  });

  it("clears only untouched fields when the category is unset", () => {
    const next = applyYouTubePlanCategoryPack({
      category: "",
      current: {
        videoType: "storytelling",
        targetAudience: "kids_and_families",
        videoGoal: "inspire",
        brandStyle: "playful_fun",
      },
      touched: {
        videoType: false,
        targetAudience: false,
        videoGoal: true,
        brandStyle: false,
      },
    });
    expect(next.planCategory).toBe("");
    expect(next.videoType).toBe("");
    expect(next.targetAudience).toBe("");
    expect(next.videoGoal).toBe("inspire");
    expect(next.brandStyle).toBe("");
  });
});
