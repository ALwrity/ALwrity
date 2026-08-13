import {
  WEDGE_BACK_LABELS,
  WEDGE_NESTED_BACK_LABELS,
  WEDGE_SUB_MODAL_CLASS,
  wedgePostSizeModalClassName,
  wedgePostSizeSubModalProps,
  wedgeSubModalClassName,
  wedgeSubModalShellProps,
} from "../components/dashboard/wedgeModalUi";
import { POST_WEDGE_MODAL_SIZE_CLASS } from "../components/dashboard/wedgeModalLayout";

describe("wedgeModalUi", () => {
  it("defines back labels for every workflow wedge", () => {
    expect(WEDGE_BACK_LABELS).toEqual({
      plan: "Plan",
      create: "Quick Create",
      publish: "Publish",
      analysis: "Analysis",
      engagement: "Engagement",
      remarket: "Remarket",
    });
  });

  it("defines nested drill-down back labels", () => {
    expect(WEDGE_NESTED_BACK_LABELS.myDrafts).toBe("My Drafts");
    expect(WEDGE_NESTED_BACK_LABELS.engagementTrends).toBe("Engagement Trends");
  });

  it("wedgeSubModalShellProps returns shared drill-down header config", () => {
    expect(wedgeSubModalShellProps("Publish")).toEqual({
      backLabel: "Publish",
      titleSize: "xl",
      headerLayout: "centeredRow",
    });
  });

  it("wedgeSubModalClassName appends optional modifier class", () => {
    expect(wedgeSubModalClassName()).toBe(WEDGE_SUB_MODAL_CLASS);
    expect(wedgeSubModalClassName("linkedin-plan-saved-ideas-modal")).toBe(
      `${WEDGE_SUB_MODAL_CLASS} linkedin-plan-saved-ideas-modal`,
    );
  });

  it("wedgePostSizeModalClassName includes post-size shell class", () => {
    expect(wedgePostSizeModalClassName()).toBe(
      `${WEDGE_SUB_MODAL_CLASS} ${POST_WEDGE_MODAL_SIZE_CLASS}`,
    );
    expect(wedgePostSizeModalClassName("linkedin-my-drafts-modal")).toBe(
      `${WEDGE_SUB_MODAL_CLASS} ${POST_WEDGE_MODAL_SIZE_CLASS} linkedin-my-drafts-modal`,
    );
  });

  it("wedgePostSizeSubModalProps merges shell props with post-modal size", () => {
    expect(wedgePostSizeSubModalProps("Quick Create")).toEqual({
      backLabel: "Quick Create",
      titleSize: "xl",
      headerLayout: "centeredRow",
      width: "min(77.6vw, 960px)",
      maxWidth: "min(77.6vw, 960px)",
      maxHeight: "min(98dvh, calc(100dvh - 8px))",
    });
  });
});
