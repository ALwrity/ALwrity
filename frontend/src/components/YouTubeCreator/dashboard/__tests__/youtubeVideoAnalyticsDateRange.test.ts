import {
  analyticsMonthOptions,
  analyticsYearOptions,
  calendarMonthRange,
  calendarYearRange,
  defaultCustomRange,
  formatSelectionRange,
  openNativeDatePicker,
  toOverviewRequest,
  validateCustomRange,
} from "../youtubeVideoAnalyticsDateRange";

const TODAY = new Date(2026, 8, 8);

describe("youtubeVideoAnalyticsDateRange", () => {
  it("lists only the current year and previous year", () => {
    expect(analyticsYearOptions(TODAY)).toEqual([2026, 2025]);
    expect(analyticsYearOptions(new Date("not-a-date"))).toEqual([]);
  });

  it("lists only the current month and previous month", () => {
    expect(analyticsMonthOptions(TODAY)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 8 },
    ]);
    expect(analyticsMonthOptions(new Date(2026, 0, 15))).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });

  it("builds 2026 YTD, previous-year, and month bounds", () => {
    expect(calendarYearRange(2026, TODAY)).toEqual({
      start: "2026-01-01",
      end: "2026-09-08",
    });
    expect(calendarYearRange(2025, TODAY)).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    });
    expect(calendarYearRange(2027, TODAY)).toBeNull();
    expect(calendarMonthRange(2026, 9, TODAY)).toEqual({
      start: "2026-09-01",
      end: "2026-09-08",
    });
    expect(calendarMonthRange(2026, 8, TODAY)).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("rejects invalid custom ranges and accepts a valid span", () => {
    expect(validateCustomRange("2026-09-01", "2026-09-09", TODAY).ok).toBe(false);
    expect(validateCustomRange("2025-01-01", "2026-01-02", TODAY).ok).toBe(false);
    expect(validateCustomRange("2026-09-08", "2026-09-01", TODAY).ok).toBe(false);
    expect(validateCustomRange("", "2026-09-08", TODAY).ok).toBe(false);
    expect(validateCustomRange("2026-08-01", "2026-08-31", TODAY)).toEqual({
      ok: true,
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("maps selections to Overview request params", () => {
    expect(
      toOverviewRequest({ type: "rolling", id: "last_90", days: 90 }, TODAY),
    ).toEqual({ window: "last_90", days: 90 });
    expect(
      toOverviewRequest({ type: "rolling", id: "last_365", days: 365 }, TODAY),
    ).toEqual({ window: "last_365", days: 365 });
    expect(toOverviewRequest({ type: "lifetime", id: "lifetime" }, TODAY)).toEqual({
      window: "lifetime",
    });
    expect(
      toOverviewRequest({ type: "year", id: "year-2026", year: 2026 }, TODAY),
    ).toEqual({
      window: "calendar",
      start_date: "2026-01-01",
      end_date: "2026-09-08",
    });
    expect(
      toOverviewRequest({ type: "year", id: "year-2025", year: 2025 }, TODAY),
    ).toEqual({
      window: "calendar",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    });
    expect(
      toOverviewRequest(
        { type: "month", id: "month-2026-8", year: 2026, month: 8 },
        TODAY,
      ),
    ).toEqual({
      window: "calendar",
      start_date: "2026-08-01",
      end_date: "2026-08-31",
    });
    expect(
      toOverviewRequest(
        { type: "custom", id: "custom", start: "2026-08-01", end: "2026-08-31" },
        TODAY,
      ),
    ).toEqual({
      window: "calendar",
      start_date: "2026-08-01",
      end_date: "2026-08-31",
    });
    expect(
      toOverviewRequest(
        { type: "custom", id: "custom", start: "2026-09-01", end: "2026-09-09" },
        TODAY,
      ),
    ).toBeNull();
  });

  it("labels rolling ranges without inventing a YouTube-era start date", () => {
    expect(
      formatSelectionRange({ type: "rolling", id: "last_7", days: 7 }, TODAY),
    ).toBe("Sep 1 – Sep 8, 2026");
    expect(
      formatSelectionRange({ type: "rolling", id: "last_90", days: 90 }, TODAY),
    ).toBe("Jun 10 – Sep 8, 2026");
    expect(
      formatSelectionRange({ type: "rolling", id: "last_365", days: 365 }, TODAY),
    ).toBe("Sep 8, 2025 – Sep 8, 2026");
    expect(formatSelectionRange({ type: "lifetime", id: "lifetime" }, TODAY)).toBe(
      "Lifetime",
    );
    expect(
      formatSelectionRange({ type: "rolling", id: "last_28", days: 28 }, new Date("not-a-date")),
    ).toBe("—");
  });

  it("defaults custom start/end to the last 28 days through today", () => {
    expect(defaultCustomRange(TODAY)).toEqual({
      start: "2026-08-11",
      end: "2026-09-08",
    });
  });

  it("opens the native date picker when the browser supports it", () => {
    const showPicker = vi.fn();
    openNativeDatePicker({ showPicker } as unknown as HTMLInputElement);
    expect(showPicker).toHaveBeenCalledTimes(1);
    openNativeDatePicker(null);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("warns without throwing when the native picker is blocked", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    openNativeDatePicker({
      showPicker: () => {
        throw new Error("NotAllowedError");
      },
    } as unknown as HTMLInputElement);
    expect(warn.mock.calls.join(" ")).toMatch(/Native date picker could not open/);
    warn.mockRestore();
  });
});
