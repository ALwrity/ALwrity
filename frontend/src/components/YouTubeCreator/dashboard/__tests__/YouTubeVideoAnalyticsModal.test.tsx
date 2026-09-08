/**
 * Video Analytics modal — Studio tabs and date chrome only. No API, no fake metrics.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeVideoAnalyticsModal } from "../modals/YouTubeVideoAnalyticsModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      ...actual.youtubeStudioApi,
      listChannelVideos: vi.fn(),
      getVideoAnalytics: vi.fn(),
      getChannelPulse: vi.fn(),
    },
  };
});

const mockedStudioApi = vi.mocked(youtubeStudioApi);

describe("YouTubeVideoAnalyticsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(<YouTubeVideoAnalyticsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: "Video analytics" })).toBeNull();
  });

  it("opens Studio tabs with Overview selected and waiting copy", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Video analytics" })).toBeTruthy();
    const tablist = screen.getByRole("tablist", { name: "Video analytics sections" });
    expect(tablist).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toHaveTextContent(
      "Overview metrics will show here when analytics is connected.",
    );
    expect(screen.getByText("Last 28 days")).toBeTruthy();
    expect(screen.getByText(/–.*,\s*\d{4}/)).toBeTruthy();
    expect(mockedStudioApi.listChannelVideos).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(info.mock.calls.join(" ")).toMatch(/\[YouTubeVideoAnalytics\] Open/);
    info.mockRestore();
  });

  it("switches to Reach and shows Reach waiting copy", () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Reach" }));

    expect(screen.getByRole("tab", { name: "Reach" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Reach" })).toHaveTextContent(
      "Reach metrics will show here when analytics is connected.",
    );
    expect(screen.queryByText(/Overview metrics will show/)).toBeNull();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
  });

  it("shows Engagement and Audience waiting copy without fake counts", () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Engagement" }));
    expect(screen.getByRole("tabpanel", { name: "Engagement" })).toHaveTextContent(
      "Engagement metrics will show here when analytics is connected.",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Audience" }));
    expect(screen.getByRole("tabpanel", { name: "Audience" })).toHaveTextContent(
      "Audience metrics will show here when analytics is connected.",
    );
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent(/\d/);
  });

  it("moves to Reach with the right arrow key", () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Reach" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("returns to Analysis from the shell back control", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <YouTubeVideoAnalyticsModal
        open
        onClose={onClose}
        shell={{
          maxWidth: 1100,
          onBack,
          backLabel: "Analysis",
          titleSize: "xl",
          headerLayout: "centeredRow",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to Analysis" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates the date range line for All time without fetching", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "All time" }));

    const rangeLines = screen.getAllByText("All time");
    expect(rangeLines.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Last 28 days")).toBeNull();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
    expect(info.mock.calls.join(" ")).toMatch(/Range changed/);
    expect(info.mock.calls.join(" ").toLowerCase()).not.toMatch(
      /vid-|token|authorization/,
    );
    info.mockRestore();
  });

  it("updates the date preset locally without fetching", () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Last 7 days" }));

    expect(screen.getByText("Last 7 days")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Last 7 days" })).toBeNull();
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
  });

  it("closes the date menu on Escape without leaving the modal", () => {
    const onClose = vi.fn();
    render(<YouTubeVideoAnalyticsModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    expect(screen.getByRole("option", { name: "Last 7 days" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: /Analytics date range/i }), {
      key: "Escape",
    });
    expect(screen.queryByRole("option", { name: "Last 7 days" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Video analytics" })).toBeTruthy();
  });
});
