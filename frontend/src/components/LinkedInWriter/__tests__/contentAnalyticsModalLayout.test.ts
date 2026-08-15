import {
  CONTENT_ANALYTICS_MODAL_CLASS,
  CONTENT_ANALYTICS_MODAL_SIZE,
} from "../components/dashboard/contentAnalyticsModalLayout";

describe("contentAnalyticsModalLayout", () => {
  it("matches Optimise Profile dialog dimensions", () => {
    expect(CONTENT_ANALYTICS_MODAL_SIZE).toEqual({
      width: "min(97vw, 1820px)",
      maxWidth: "min(97vw, 1820px)",
      maxHeight: "min(98dvh, calc(100dvh - 8px))",
    });
    expect(CONTENT_ANALYTICS_MODAL_CLASS).toBe(
      "linkedin-content-analytics-modal",
    );
  });
});
