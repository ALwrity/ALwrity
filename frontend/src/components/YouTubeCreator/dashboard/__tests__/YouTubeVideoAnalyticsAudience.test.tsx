/**
 * Audience panels — Hub tables and KPI cells. No invented percentages.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
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
  it("renders Hub sections including Device type from live rows", () => {
    render(
      <YouTubeVideoAnalyticsAudience payload={PAYLOAD} status={null} />,
    );
    expect(screen.getByRole("heading", { name: "Age and gender" })).toBeTruthy();
    expect(screen.getByText("18–24")).toBeTruthy();
    expect(screen.getByText("Female")).toBeTruthy();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Top countries" })).toBeTruthy();
    expect(screen.getByText("Unknown country")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Views" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Watch time (hours)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Subscribers watching" })).toBeTruthy();
    expect(screen.getByText("Subscribed")).toBeTruthy();
    expect(screen.getByText("Unsubscribed")).toBeTruthy();
    const subscribedKpi = screen.getByText("Subscribed").closest(
      ".yt-video-analytics-audience__kpi",
    );
    expect(subscribedKpi?.textContent).not.toMatch(/Subscribed80/);
    expect(subscribedKpi).toHaveTextContent("Views");
    expect(subscribedKpi).toHaveTextContent("Watch time (hours)");
    expect(document.querySelector(".yt-video-analytics-audience__bar")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Device type" })).toBeTruthy();
    expect(screen.getAllByText("Watch time (hours)").length).toBeGreaterThan(1);
    expect(screen.getByText("Computer")).toBeTruthy();
    expect(screen.getByText("Mobile phone")).toBeTruthy();
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    const stackSeg = document.querySelector(
      ".yt-video-analytics-audience__stack-seg",
    ) as HTMLElement | null;
    expect(stackSeg?.style.flexGrow).toBe("60");
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
      screen.getByText("Audience countries are unavailable for this window."),
    ).toBeTruthy();
    expect(screen.queryByText("50%")).toBeNull();
    expect(
      screen.getByText("Audience device type is unavailable for this window."),
    ).toBeTruthy();
    expect(screen.queryByText("25%")).toBeNull();
  });

  it("shows loading and unavailable status without panels", () => {
    const { rerender } = render(
      <YouTubeVideoAnalyticsAudience
        payload={null}
        status="Loading channel audience."
      />,
    );
    expect(screen.getByText("Loading channel audience.")).toBeTruthy();
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
