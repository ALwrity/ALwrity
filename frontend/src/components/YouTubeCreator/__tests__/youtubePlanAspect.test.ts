/**
 * Plan Your Video aspect helper — defaults from duration, never overwrite a saved ratio.
 */
import {
  parseYouTubePlanAspect,
  youtubePlanAspectFromDuration,
  youtubePlanDurationHint,
} from "../components/youtubePlanAspect";

describe("youtubePlanAspect", () => {
  it("defaults shorts to 9:16 and medium or long to 16:9", () => {
    expect(youtubePlanAspectFromDuration("shorts")).toBe("9:16");
    expect(youtubePlanAspectFromDuration("medium")).toBe("16:9");
    expect(youtubePlanAspectFromDuration("long")).toBe("16:9");
  });

  it("keeps a stored 9:16 ratio when duration is medium or long", () => {
    expect(parseYouTubePlanAspect("9:16", "long")).toBe("9:16");
    expect(parseYouTubePlanAspect("16:9", "shorts")).toBe("16:9");
  });

  it("derives from duration when aspect is missing", () => {
    expect(parseYouTubePlanAspect(undefined, "shorts")).toBe("9:16");
    expect(parseYouTubePlanAspect(null, "medium")).toBe("16:9");
  });

  it("warns and uses the duration default for unknown stored values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseYouTubePlanAspect("1:1", "shorts")).toBe("9:16");
    expect(parseYouTubePlanAspect("square", "medium")).toBe("16:9");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not treat a duration change as an aspect overwrite", () => {
    const userRatio = parseYouTubePlanAspect("9:16", "shorts");
    expect(userRatio).toBe("9:16");
    expect(parseYouTubePlanAspect(userRatio, "long")).toBe("9:16");
  });

  it("returns a one-line hint for the selected duration", () => {
    expect(youtubePlanDurationHint("shorts")).toMatch(/≤60s/i);
    expect(youtubePlanDurationHint("medium")).toMatch(/1-4/i);
    expect(youtubePlanDurationHint("long")).toMatch(/4-10/i);
  });
});
