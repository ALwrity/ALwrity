/**
 * Audience panels — Hub tables and KPI cells. No invented percentages.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeVideoAnalyticsAudience } from "../modals/YouTubeVideoAnalyticsAudience";

const PAYLOAD = {
  success: true,
  demographics: {
    available: true,
    rows: [
      { age_group: "age18-24", gender: "female", viewer_percentage: 40 },
      { age_group: "age25-34", gender: "male", viewer_percentage: 60 },
    ],
    message: null,
  },
  countries: {
    available: true,
    rows: [
      { country: "US", label: "US", views: 50, watch_hours: 1.2 },
      { country: "ZZ", label: "Unknown country", views: 10, watch_hours: 0.2 },
    ],
    message: null,
  },
  subscribed: {
    available: true,
    rows: [
      { status: "SUBSCRIBED", views: 80, watch_hours: 2 },
      { status: "UNSUBSCRIBED", views: 20, watch_hours: 0.5 },
    ],
    message: null,
  },
  devices: {
    available: true,
    rows: [
      { device_type: "DESKTOP", views: 80, watch_hours: 1, watch_share_percent: 60 },
      { device_type: "MOBILE", views: 20, watch_hours: 0.7, watch_share_percent: 40 },
    ],
    message: null,
  },
};

describe("YouTubeVideoAnalyticsAudience", () => {
  it("shows Hub chips and one Age and gender panel by default", () => {
    render(
      <YouTubeVideoAnalyticsAudience payload={PAYLOAD} status={null} />,
    );
    expect(screen.getByRole("button", { name: "Age and gender" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Top countries" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Subscribers watching" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Device type" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Age and gender" })).toHaveAttribute(
      "data-tooltip",
      "Viewer share by age and gender for this date range.",
    );
    expect(screen.getByRole("button", { name: "Top countries" })).toHaveAttribute(
      "data-tooltip",
      "Views and watch time by country for this date range.",
    );
    expect(
      screen.getByRole("button", { name: "Subscribers watching" }),
    ).toHaveAttribute(
      "data-tooltip",
      "Views and watch time from subscribed and unsubscribed viewers.",
    );
    expect(screen.getByRole("button", { name: "Device type" })).toHaveAttribute(
      "data-tooltip",
      "Watch time share by device for this date range.",
    );
    expect(
      screen.getByRole("button", { name: "Age and gender" }),
    ).toHaveAttribute(
      "aria-describedby",
      "yt-video-analytics-audience-tip-demographics",
    );
    expect(
      screen.getByText("Viewer share by age and gender for this date range."),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Age and gender" })).toBeTruthy();
    expect(screen.getByText("18–24")).toBeTruthy();
    expect(screen.getByText("Female")).toBeTruthy();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);
    expect(document.querySelector(".yt-video-analytics-audience__bar")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Top countries" })).toBeNull();
    expect(screen.queryByText("Unknown country")).toBeNull();
    expect(screen.queryByText("Computer")).toBeNull();
    expect(document.querySelector(".yt-video-analytics-tabs")).toBeNull();
    expect(document.getElementById("yt-video-analytics-audience-tip-countries")).toBeTruthy();
    expect(document.getElementById("yt-video-analytics-audience-tip-subscribed")).toBeTruthy();
    expect(document.getElementById("yt-video-analytics-audience-tip-devices")).toBeTruthy();
  });

  it("logs section id when switching chips and ignores a repeat click", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(
      <YouTubeVideoAnalyticsAudience payload={PAYLOAD} status={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Age and gender" }));
    expect(info).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Top countries" }));
    expect(info).toHaveBeenCalledWith(
      "[YouTubeVideoAnalytics] Audience section",
      { section: "countries" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Top countries" }));
    expect(info).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(info.mock.calls);
    expect(payload.toLowerCase()).not.toMatch(/female|unknown country|us/);
    info.mockRestore();
  });

  it("switches one full-width Hub panel from live rows without inventing share", () => {
    render(
      <YouTubeVideoAnalyticsAudience payload={PAYLOAD} status={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Top countries" }));
    expect(screen.getByRole("heading", { name: "Top countries" })).toBeTruthy();
    expect(screen.getByText("Unknown country")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Views" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Watch time (hours)" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Age and gender" })).toBeNull();
    expect(screen.queryByText("18–24")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Subscribers watching" }));
    expect(screen.getByRole("heading", { name: "Subscribers watching" })).toBeTruthy();
    expect(screen.getByText("Subscribed")).toBeTruthy();
    expect(screen.getByText("Unsubscribed")).toBeTruthy();
    const subscribedKpi = screen.getByText("Subscribed").closest(
      ".yt-video-analytics-audience__kpi",
    );
    expect(subscribedKpi?.textContent).not.toMatch(/Subscribed80/);
    expect(subscribedKpi).toHaveTextContent("Views");
    expect(subscribedKpi).toHaveTextContent("Watch time (hours)");
    expect(screen.queryByText("Unknown country")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Device type" }));
    expect(screen.getByRole("heading", { name: "Device type" })).toBeTruthy();
    expect(screen.getAllByText("Watch time (hours)").length).toBeGreaterThan(0);
    expect(screen.getByText("Computer")).toBeTruthy();
    expect(screen.getByText("Mobile phone")).toBeTruthy();
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    const stackSeg = document.querySelector(
      ".yt-video-analytics-audience__stack-seg",
    ) as HTMLElement | null;
    expect(stackSeg?.style.flexGrow).toBe("60");
    expect(screen.queryByText("Subscribed")).toBeNull();
  });

  it("shows section copy instead of invented demographics", () => {
    render(
      <YouTubeVideoAnalyticsAudience
        payload={{
          success: true,
          demographics: {
            available: true,
            rows: [],
            message: "No demographic data in this period.",
          },
          countries: {
            available: false,
            rows: [],
            message: "Audience countries are unavailable for this window.",
          },
          subscribed: {
            available: true,
            rows: [],
            message: "No subscribed-viewer data in this period.",
          },
          devices: {
            available: false,
            rows: [],
            message: "Audience device type is unavailable for this window.",
          },
        }}
        status={null}
      />,
    );
    expect(screen.getByText("No demographic data in this period.")).toBeTruthy();
    expect(
      screen.queryByText("Audience countries are unavailable for this window."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Top countries" }));
    expect(
      screen.getByText("Audience countries are unavailable for this window."),
    ).toBeTruthy();
    expect(screen.queryByText("50%")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Device type" }));
    expect(
      screen.getByText("Audience device type is unavailable for this window."),
    ).toBeTruthy();
    expect(screen.queryByText("25%")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Subscribers watching" }));
    expect(
      screen.getByText("No subscribed-viewer data in this period."),
    ).toBeTruthy();
    expect(screen.queryByText("50%")).toBeNull();
  });

  it("shows loading and unavailable status without panels", () => {
    const { rerender } = render(
      <YouTubeVideoAnalyticsAudience
        payload={null}
        status="Loading channel audience."
      />,
    );
    expect(screen.getByText("Loading channel audience.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Age and gender" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Age and gender" })).toBeNull();
    rerender(
      <YouTubeVideoAnalyticsAudience
        payload={{
          success: false,
          message: "Connect YouTube to load channel audience.",
        }}
        status={null}
      />,
    );
    expect(screen.getByText("Connect YouTube to load channel audience.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Top countries" })).toBeNull();
  });
});
