/**
 * Status bar while a Video Analytics Overview or Audience fetch is in flight.
 * Same PlanStatusProgressPanel chrome as Comment Reply Assistant.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { YouTubeVideoAnalyticsProgressPanel } from "../YouTubeVideoAnalyticsProgressPanel";
import { YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS } from "../youtubeVideoAnalyticsLoader";

describe("YouTubeVideoAnalyticsProgressPanel", () => {
  it("shows Overview status and ticks messages without logging PII", () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { unmount } = render(
      <YouTubeVideoAnalyticsProgressPanel fetch="overview" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading channel overview");
    expect(status).toHaveTextContent("Checking the date range");
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeVideoAnalytics] Progress started",
      { fetch: "overview" },
    );
    act(() => {
      vi.advanceTimersByTime(YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Asking YouTube Analytics",
    );
    unmount();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeVideoAnalytics] Progress stopped",
      { fetch: "overview" },
    );
    expect(JSON.stringify(info.mock.calls).toLowerCase()).not.toMatch(
      /how to start|female|vid-top/,
    );
    info.mockRestore();
    vi.useRealTimers();
  });

  it("renders nothing for an unknown fetch id", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <YouTubeVideoAnalyticsProgressPanel fetch="not-a-fetch" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
