import { describe, expect, it } from "vitest";
import { taskQualityChips, QualityChip } from "../todayTaskQuality";
import type { TodayTask } from "../../types/workflow";

function task(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    id: "1",
    pillarId: "plan",
    title: "Draft strategy",
    description: "d",
    status: "pending",
    priority: "medium",
    estimatedTime: 5,
    actionType: "create_content",
    enabled: true,
    ...overrides,
  };
}

describe("taskQualityChips", () => {
  it("adds a green confidence chip for confidence >= 0.6", () => {
    const chips = taskQualityChips(task({ metadata: { confidence: 0.8 } }));
    const conf = chips.find((c) => c.label.includes("confidence"));
    expect(conf?.label).toBe("80% confidence");
    expect(conf?.tone).toBe("success");
  });

  it("adds an amber confidence chip for mid confidence", () => {
    const conf = taskQualityChips(task({ metadata: { confidence: 0.5 } }))
      .find((c) => c.label.includes("confidence"));
    expect(conf?.tone).toBe("warning");
  });

  it("adds a grey confidence chip for low confidence", () => {
    const conf = taskQualityChips(task({ metadata: { confidence: 0.2 } }))
      .find((c) => c.label.includes("confidence"));
    expect(conf?.tone).toBe("default");
  });

  it("flags template_fallback synthesis as a warning chip", () => {
    const fallback = taskQualityChips(task({ metadata: { synthesis_mode: "template_fallback" } }))
      .find((c) => c.tone === "warning");
    expect(fallback?.label).toBe("Template fallback");
  });

  it("labels llm synthesis as AI-generated", () => {
    const chip = taskQualityChips(task({ metadata: { synthesis_mode: "llm" } }))
      .find((c) => c.label === "AI-generated");
    expect(chip?.tone).toBe("info");
  });

  it("labels data_derived synthesis as Data-derived", () => {
    const chip = taskQualityChips(task({ metadata: { synthesis_mode: "data_derived" } }))
      .find((c) => c.label === "Data-derived");
    expect(chip?.tone).toBe("success");
  });

  it("shows ROI chip when roi_score is present", () => {
    const roi = taskQualityChips(task({ metadata: { roi_score: 0.75 } }))
      .find((c) => c.label.includes("ROI"));
    expect(roi?.label).toBe("75% ROI");
  });

  it("prefers impact_label over ROI when both are present", () => {
    const chip = taskQualityChips(task({ metadata: { roi_score: 0.4, impact_label: "high" } }))
      .find((c) => c.label.includes("high"));
    expect(chip?.label).toBe("Impact: high");
  });

  it("returns an empty list for a task with no quality data", () => {
    expect(taskQualityChips(task())).toEqual([]);
  });

  it("returns an empty list when metadata is absent", () => {
    expect(taskQualityChips(task({ metadata: undefined }))).toEqual([]);
  });

  it("never emits clickable/actionable junk and all labels are non-empty", () => {
    const chips = taskQualityChips(task({ metadata: { confidence: 0.9, synthesis_mode: "llm", roi_score: 0.9 } }));
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c: QualityChip) => c.label.length > 0)).toBe(true);
  });
});