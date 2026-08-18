import { toYouTubePublishAtIso } from "./youtubePublishSchedule";

describe("toYouTubePublishAtIso", () => {
  it("returns undefined for empty or invalid input", () => {
    expect(toYouTubePublishAtIso("")).toBeUndefined();
    expect(toYouTubePublishAtIso("   ")).toBeUndefined();
    expect(toYouTubePublishAtIso("not-a-date")).toBeUndefined();
  });

  it("converts a local datetime to ISO UTC without millis", () => {
    const iso = toYouTubePublishAtIso("2026-08-20T15:00");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});
