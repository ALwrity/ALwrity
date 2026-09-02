import { toYouTubePublishAtIso } from "./youtubePublishSchedule";

describe("toYouTubePublishAtIso", () => {
  it("returns undefined for empty, whitespace, or invalid input", () => {
    expect(toYouTubePublishAtIso("")).toBeUndefined();
    expect(toYouTubePublishAtIso("   ")).toBeUndefined();
    expect(toYouTubePublishAtIso("not-a-date")).toBeUndefined();
    expect(toYouTubePublishAtIso("2026-13-40T99:99")).toBeUndefined();
  });

  it("converts a datetime-local value to ISO-8601 UTC with no milliseconds", () => {
    const iso = toYouTubePublishAtIso("2026-08-20T15:00");
    expect(iso).toBeDefined();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(iso).not.toMatch(/\.\d{3}Z$/);
  });

  it("round-trips to the same instant as Date#toISOString without millis", () => {
    const localValue = "2026-08-20T15:00";
    const iso = toYouTubePublishAtIso(localValue);
    const fromNative = new Date(localValue).toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(iso).toBe(fromNative);
  });
});
