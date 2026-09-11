/**
 * Status bar while Channel Pulse or Video Performance fetch is in flight.
 * Same PlanStatusProgressPanel chrome as Video Analytics.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { YouTubeAnalysisWedgeProgressPanel } from "../YouTubeAnalysisWedgeProgressPanel";
import { YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS } from "../youtubeAnalysisWedgeLoader";

describe("YouTubeAnalysisWedgeProgressPanel", () => {
  it("shows Pulse status and ticks messages without logging PII", () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { unmount } = render(
      <YouTubeAnalysisWedgeProgressPanel fetch="pulse" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading channel pulse");
    expect(status).toHaveTextContent("Checking your channel");
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeAnalysisWedge] Progress started",
      { fetch: "pulse" },
    );
    act(() => {
      vi.advanceTimersByTime(YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Asking YouTube Data and Analytics",
    );
    unmount();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeAnalysisWedge] Progress stopped",
      { fetch: "pulse" },
    );
    expect(JSON.stringify(info.mock.calls).toLowerCase()).not.toMatch(
      /how to start|female|vid-top/,
    );
    info.mockRestore();
    vi.useRealTimers();
  });

  it("shows Performance status without inventing watch time", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { unmount } = render(
      <YouTubeAnalysisWedgeProgressPanel fetch="performance" />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading video performance");
    expect(status.textContent?.toLowerCase()).not.toMatch(/watch time|ctr/);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeAnalysisWedge] Progress started",
      { fetch: "performance" },
    );
    unmount();
    expect(info).toHaveBeenCalledWith(
      "[YouTubeAnalysisWedge] Progress stopped",
      { fetch: "performance" },
    );
    info.mockRestore();
  });

  it("renders nothing for an unknown fetch id", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <YouTubeAnalysisWedgeProgressPanel fetch="not-a-fetch" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
