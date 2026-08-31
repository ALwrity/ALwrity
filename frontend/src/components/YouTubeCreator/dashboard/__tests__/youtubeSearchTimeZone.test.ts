import { resolveYouTubeSearchTimeZone } from "./youtubeSearchTimeZone";

describe("resolveYouTubeSearchTimeZone", () => {
  it("returns the browser IANA time zone without hardcoding a city", () => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(resolveYouTubeSearchTimeZone()).toBe(resolved);
    expect(resolveYouTubeSearchTimeZone().length).toBeGreaterThan(0);
  });

  it("falls back to UTC when Intl timeZone is empty", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ timeZone: "   " }),
    } as Intl.DateTimeFormat);
    expect(resolveYouTubeSearchTimeZone()).toBe("UTC");
    spy.mockRestore();
  });
});
