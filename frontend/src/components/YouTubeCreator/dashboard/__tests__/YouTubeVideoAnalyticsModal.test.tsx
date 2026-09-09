/**
 * Video Analytics modal — Overview loads live channel data. Other tabs stay waiting copy.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { YouTubeVideoAnalyticsModal } from "../modals/YouTubeVideoAnalyticsModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import { metricPolylinePoints } from "../youtubeVideoAnalyticsChartScale";
import {
  analyticsMonthOptions,
  monthLabel,
} from "../youtubeVideoAnalyticsDateRange";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      ...actual.youtubeStudioApi,
      listChannelVideos: vi.fn(),
      getVideoAnalytics: vi.fn(),
      getChannelPulse: vi.fn(),
      getChannelOverview: vi.fn(),
      getChannelAudience: vi.fn(),
    },
  };
});

const mockedStudioApi = vi.mocked(youtubeStudioApi);

const OVERVIEW_OK = {
  success: true,
  window_days: 28,
  current: {
    views: 127,
    watch_hours: 0.7,
    subscribers_net: 2,
  },
  previous: {
    views: 62,
    watch_hours: 0.3,
    subscribers_net: 1,
  },
  views_by_day: [
    { date: "2026-08-10", views: 0, watch_hours: 0, subscribers_net: 0 },
    { date: "2026-09-04", views: 27, watch_hours: 0.3, subscribers_net: 2 },
  ],
  top_videos: [
    {
      video_id: "vid-top",
      title: "How to start",
      views: 80,
      average_view_duration_seconds: 18,
      average_view_percentage: 64.3,
    },
  ],
  latest_videos: [
    {
      video_id: "vid-latest-1",
      title: "Latest upload",
      view_count: 12,
      like_count: 3,
    },
    {
      video_id: "vid-latest-2",
      title: "Second latest",
      view_count: 4,
      like_count: 1,
    },
  ],
};

const AUDIENCE_OK = {
  success: true,
  demographics: {
    available: true,
    rows: [{ age_group: "age18-24", gender: "female", viewer_percentage: 40 }],
    message: null,
  },
  countries: {
    available: true,
    rows: [{ country: "US", label: "US", views: 50, watch_hours: 1.2 }],
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
      { device_type: "DESKTOP", views: 10, watch_hours: 1, watch_share_percent: 100 },
    ],
    message: null,
  },
};

describe("YouTubeVideoAnalyticsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStudioApi.getChannelOverview.mockResolvedValue(OVERVIEW_OK);
    mockedStudioApi.getChannelAudience.mockResolvedValue(AUDIENCE_OK);
  });

  it("does not render when closed", () => {
    render(<YouTubeVideoAnalyticsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog", { name: "Video analytics" })).toBeNull();
    expect(mockedStudioApi.getChannelOverview).not.toHaveBeenCalled();
  });

  it("loads Overview from getChannelOverview and shows headline plus cards", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Video analytics" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => {
      expect(screen.getByText("Your channel got 127 views in the last 28 days.")).toBeTruthy();
    });
    expect(screen.getByText("0.7")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("105% more than previous 28 days")).toBeTruthy();
    expect(screen.getByText("How to start")).toBeTruthy();
    expect(screen.getByText("Latest upload")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Daily views" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /see more/i })).toBeNull();
    const polyline = document.querySelector(
      ".yt-video-analytics-overview__chart polyline",
    );
    expect(polyline?.getAttribute("points")).toBe(
      metricPolylinePoints(OVERVIEW_OK.views_by_day, "views", 320, 96, 0),
    );
    expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
      window: "last_28",
      days: 28,
    });
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(mockedStudioApi.listChannelVideos).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
    expect(mockedStudioApi.getChannelAudience).not.toHaveBeenCalled();
    const logs = info.mock.calls.join(" ");
    expect(logs).toMatch(/\[YouTubeVideoAnalytics\] Open/);
    expect(logs).toMatch(/Overview complete/);
    expect(logs.toLowerCase()).not.toMatch(/how to start|latest upload|vid-top/);
    info.mockRestore();
  });

  it("shows the API message for not_connected without fake metrics", async () => {
    mockedStudioApi.getChannelOverview.mockResolvedValue({
      success: false,
      error_code: "not_connected",
      message: "Connect YouTube to load channel overview.",
    });
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByText("Connect YouTube to load channel overview."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/Your channel got 127/)).toBeNull();
    expect(screen.queryByText("0.7")).toBeNull();
  });

  it("shows analytics_unavailable from the API without fake headline counts", async () => {
    mockedStudioApi.getChannelOverview.mockResolvedValue({
      success: false,
      error_code: "analytics_unavailable",
      message: "Channel overview is unavailable for this window.",
    });
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(
        screen.getByText("Channel overview is unavailable for this window."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/Your channel got 127/)).toBeNull();
  });

  it("hides unexpected HTTP error text and shows a generic Overview failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedStudioApi.getChannelOverview.mockRejectedValue({
      name: "AxiosError",
      response: { data: { detail: "filters=video==secret" } },
    });
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Channel overview request failed.")).toBeTruthy();
    });
    expect(screen.queryByText(/video==/)).toBeNull();
    expect(errorSpy.mock.calls.join(" ")).not.toMatch(/video==|secret/);
    errorSpy.mockRestore();
  });

  it("switches to Reach without a second overview call and shows Reach waiting copy", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Reach" }));

    expect(screen.getByRole("tab", { name: "Reach" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Reach" })).toHaveTextContent(
      "Reach metrics will show here when analytics is connected.",
    );
    expect(screen.queryByText(/Overview metrics will show/)).toBeNull();
    expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    expect(mockedStudioApi.getChannelAudience).not.toHaveBeenCalled();
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
  });

  it("shows Engagement waiting copy and loads Audience from getChannelAudience", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("tab", { name: "Engagement" }));
    expect(screen.getByRole("tabpanel", { name: "Engagement" })).toHaveTextContent(
      "Engagement metrics will show here when analytics is connected.",
    );
    expect(mockedStudioApi.getChannelAudience).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Audience" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Age and gender" })).toBeTruthy();
    });
    expect(screen.getByText("18–24")).toBeTruthy();
    expect(screen.getByText("Female")).toBeTruthy();
    expect(mockedStudioApi.getChannelAudience).toHaveBeenCalledWith({
      window: "last_28",
      days: 28,
    });
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
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

  it("lists Studio date groups and loads Lifetime without skipping the Overview API", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    expect(screen.getByRole("option", { name: "Last 365 days" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Lifetime" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Custom" })).toBeTruthy();
    expect(screen.getByRole("option", { name: String(new Date().getFullYear()) })).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: String(new Date().getFullYear() - 2) }),
    ).toBeNull();
    const monthChoices = analyticsMonthOptions(new Date());
    expect(monthChoices).toHaveLength(2);
    monthChoices.forEach((row) => {
      expect(screen.getByRole("option", { name: monthLabel(row.month) })).toBeTruthy();
    });
    if (!monthChoices.some((row) => row.month === 1)) {
      expect(screen.queryByRole("option", { name: "January" })).toBeNull();
    }

    fireEvent.click(screen.getByRole("option", { name: "Lifetime" }));

    expect(screen.queryByText("Last 28 days")).toBeNull();
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "lifetime",
      });
    });
    await waitFor(() => {
      expect(
        screen.getByText("Your channel got 127 views since you started."),
      ).toBeTruthy();
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(info.mock.calls.join(" ")).toMatch(/Range changed/);
    expect(info.mock.calls.join(" ")).not.toMatch(/Overview skipped/);
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/how to start/i);
    info.mockRestore();
  });

  it("refetches Overview when the date preset changes to Last 7 days", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "last_28",
        days: 28,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Last 7 days" }));

    expect(screen.getByText("Last 7 days")).toBeTruthy();
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "last_7",
        days: 7,
      });
    });
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(mockedStudioApi.getVideoAnalytics).not.toHaveBeenCalled();
  });

  it("refetches Overview for Last 365 days and the current calendar year", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Last 365 days" }));
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "last_365",
        days: 365,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    const year = String(new Date().getFullYear());
    fireEvent.click(screen.getByRole("option", { name: year }));
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          window: "calendar",
          start_date: `${year}-01-01`,
        }),
      );
    });
  });

  it("applies a valid custom range and ignores an invalid one", async () => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 10);
    const iso = (value: Date) => {
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${value.getFullYear()}-${month}-${day}`;
    };
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    expect(screen.queryByRole("option", { name: "Last 7 days" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Custom" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    const startInput = screen.getByLabelText("Start date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End date") as HTMLInputElement;
    expect(startInput).toHaveAttribute("type", "date");
    expect(endInput).toHaveAttribute("type", "date");
    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(startInput, {
      target: { value: iso(start) },
    });
    fireEvent.change(endInput, {
      target: { value: "2099-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("The end date cannot be in the future.")).toBeTruthy();
    expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);

    fireEvent.change(endInput, {
      target: { value: iso(end) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "calendar",
        start_date: iso(start),
        end_date: iso(end),
      });
    });
  });

  it("shows empty copy when top content and latest uploads are empty", async () => {
    mockedStudioApi.getChannelOverview.mockResolvedValue({
      ...OVERVIEW_OK,
      top_videos: [],
      latest_videos: [],
      views_by_day: [],
    });
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No videos ranked in this period.")).toBeTruthy();
    });
    expect(screen.getByText("No recent uploads.")).toBeTruthy();
    expect(screen.getByText("No daily views in this period.")).toBeTruthy();
  });

  it("pages locally over latest uploads without a second API call", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Latest upload")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next latest video" }));
    expect(screen.getByText("Second latest")).toBeTruthy();
    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
  });

  it("refetches Overview for Last 90 days and the previous calendar month", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Last 90 days" }));
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "last_90",
        days: 90,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    const previousMonth = analyticsMonthOptions(new Date())[1];
    fireEvent.click(
      screen.getByRole("option", { name: monthLabel(previousMonth.month) }),
    );
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledWith({
        window: "calendar",
        start_date: `${previousMonth.year}-${String(previousMonth.month).padStart(2, "0")}-01`,
        end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });

  it("closes Custom dates from Cancel without applying a range", async () => {
    render(<YouTubeVideoAnalyticsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: /Analytics date range/i }));
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    expect(screen.getByLabelText("Start date")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Start date")).toBeNull();
    expect(screen.queryByRole("option", { name: "Last 7 days" })).toBeNull();
    expect(screen.getByText("Last 28 days")).toBeTruthy();
    expect(mockedStudioApi.getChannelOverview).toHaveBeenCalledTimes(1);
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
