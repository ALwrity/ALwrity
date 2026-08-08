import {
  WEDGE_BACK_LABELS,
  WEDGE_NESTED_BACK_LABELS,
  WEDGE_SUB_MODAL_CLASS,
  wedgeSubModalClassName,
  wedgeSubModalShellProps,
} from "../components/dashboard/wedgeModalUi";

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
      backPlacement: "aboveTitle",
      titleSize: "xl",
    });
  });

  it("wedgeSubModalClassName appends optional modifier class", () => {
    expect(wedgeSubModalClassName()).toBe(WEDGE_SUB_MODAL_CLASS);
    expect(wedgeSubModalClassName("linkedin-plan-saved-ideas-modal")).toBe(
      `${WEDGE_SUB_MODAL_CLASS} linkedin-plan-saved-ideas-modal`,
    );
  });
});
