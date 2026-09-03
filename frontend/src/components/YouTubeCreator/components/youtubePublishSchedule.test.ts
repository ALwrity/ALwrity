import { toYouTubePublishAtIso, youtubeScheduleFieldSx, youtubeScheduleIsInvalid } from "./youtubePublishSchedule";
import { YT_RED } from "../constants";
import { BORDER_COLOR, BORDER_HOVER } from "../styles";

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

describe("youtubeScheduleIsInvalid", () => {
  it("is false for empty, whitespace, or a valid datetime-local value", () => {
    expect(youtubeScheduleIsInvalid("")).toBe(false);
    expect(youtubeScheduleIsInvalid("   ")).toBe(false);
    expect(youtubeScheduleIsInvalid("2026-08-20T15:00")).toBe(false);
  });

  it("is true when the field has text that cannot become publishAt", () => {
    expect(youtubeScheduleIsInvalid("not-a-date")).toBe(true);
    expect(youtubeScheduleIsInvalid("2026-13-40T99:99")).toBe(true);
  });
});

describe("youtubeScheduleFieldSx", () => {
  it("pins the calendar picker to the right of the datetime field", () => {
    const indicator =
      youtubeScheduleFieldSx[
        '& input[type="datetime-local"]::-webkit-calendar-picker-indicator'
      ];

    expect(indicator).toMatchObject({
      position: "absolute",
      left: "auto",
      right: 10,
      cursor: "pointer",
    });
  });

  it("uses Privacy-matching outlined border that darkens on hover", () => {
    const root = youtubeScheduleFieldSx["& .MuiOutlinedInput-root"];

    expect(root["& .MuiOutlinedInput-notchedOutline"]).toMatchObject({
      borderColor: BORDER_COLOR,
      borderWidth: "1.5px",
    });
    expect(root["&:hover .MuiOutlinedInput-notchedOutline"]).toMatchObject({
      borderColor: BORDER_HOVER,
    });
    expect(root["&.Mui-focused .MuiOutlinedInput-notchedOutline"]).toMatchObject({
      borderColor: YT_RED,
    });
  });
});
