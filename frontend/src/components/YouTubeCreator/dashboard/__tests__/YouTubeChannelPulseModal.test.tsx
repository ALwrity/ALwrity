/**
 * Channel Pulse modal — Hub progress while getChannelPulse is in flight.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChannelPulseModal } from "../modals/ChannelPulseModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";

vi.mock("../../../../services/youtubeStudioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../services/youtubeStudioApi")>();
  return {
    ...actual,
    youtubeStudioApi: {
      ...actual.youtubeStudioApi,
      getChannelPulse: vi.fn(),
    },
  };
});

const mockedStudioApi = vi.mocked(youtubeStudioApi);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const PULSE_OK = {
  success: true,
  lifetime: {
    subscriber_count: 12,
    view_count: 400,
    hidden_subscriber_count: false,
  },
  window: {
    available: true,
    views: 40,
    estimated_minutes_watched: 90,
  },
};

describe("ChannelPulseModal progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStudioApi.getChannelPulse.mockReset();
  });

  it("shows Pulse progress until getChannelPulse resolves", async () => {
    const pending = deferred<typeof PULSE_OK>();
    mockedStudioApi.getChannelPulse.mockReturnValueOnce(pending.promise);
    render(<ChannelPulseModal open onClose={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading channel pulse");
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText("Subscribers")).toBeNull();
    pending.resolve(PULSE_OK);
    await waitFor(() => {
      expect(screen.getByText("Subscribers")).toBeTruthy();
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("400")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(mockedStudioApi.getChannelPulse).toHaveBeenCalledWith({ days: 28 });
  });

  it("does not fetch pulse when closed", () => {
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce(PULSE_OK);
    render(<ChannelPulseModal open={false} onClose={vi.fn()} />);
    expect(mockedStudioApi.getChannelPulse).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Channel Pulse" })).toBeNull();
  });

  it("does not apply a late pulse after close", async () => {
    const pending = deferred<typeof PULSE_OK>();
    mockedStudioApi.getChannelPulse.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<ChannelPulseModal open onClose={vi.fn()} />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    rerender(<ChannelPulseModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      pending.resolve(PULSE_OK);
    });
    expect(screen.queryByText("Subscribers")).toBeNull();
    expect(screen.queryByText("12")).toBeNull();
  });

  it("shows progress instead of previous stats when reopened before the next fetch resolves", async () => {
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce(PULSE_OK);
    const { rerender } = render(<ChannelPulseModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Subscribers")).toBeTruthy();
    });
    const pending = deferred<typeof PULSE_OK>();
    mockedStudioApi.getChannelPulse.mockReturnValueOnce(pending.promise);
    rerender(<ChannelPulseModal open={false} onClose={vi.fn()} />);
    rerender(<ChannelPulseModal open onClose={vi.fn()} />);
    expect(screen.queryByText("Subscribers")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading channel pulse");
    pending.resolve(PULSE_OK);
    await waitFor(() => {
      expect(screen.getByText("Subscribers")).toBeTruthy();
    });
  });

  it("logs pulse fetch metadata without subscriber counts", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce(PULSE_OK);
    render(<ChannelPulseModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Subscribers")).toBeTruthy();
    });
    expect(info).toHaveBeenCalledWith("[YouTubeChannelPulse] Load start", {
      days: 28,
    });
    expect(info).toHaveBeenCalledWith("[YouTubeChannelPulse] Load complete", {
      windowAvailable: true,
    });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/subscriber_count/);
    info.mockRestore();
  });

  it("shows Hidden and reconnect copy without inventing analytics totals", async () => {
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce({
      success: true,
      lifetime: {
        subscriber_count: 99,
        view_count: 400,
        hidden_subscriber_count: true,
      },
      window: { available: false },
    });
    render(<ChannelPulseModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Hidden")).toBeTruthy();
    });
    expect(screen.queryByText("99")).toBeNull();
    expect(screen.getAllByText("Reconnect for Analytics")).toHaveLength(2);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows Analysis back control from the wedge shell", async () => {
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce(PULSE_OK);
    const onBack = vi.fn();
    render(
      <ChannelPulseModal
        open
        onClose={vi.fn()}
        shell={{ maxWidth: 1100, onBack, backLabel: "Analysis" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to Analysis" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockedStudioApi.getChannelPulse).toHaveBeenCalled();
    });
  });

  it("hides unexpected HTTP error text and shows a generic pulse failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedStudioApi.getChannelPulse.mockRejectedValueOnce({
      name: "AxiosError",
      response: { data: { detail: "channel==secret" } },
    });
    render(<ChannelPulseModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Could not load channel pulse.")).toBeTruthy();
    });
    expect(screen.queryByText(/channel==/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(errorSpy.mock.calls.join(" ")).not.toMatch(/channel==|secret/);
    errorSpy.mockRestore();
  });

  it("shows API unsuccessful message without fake subscriber counts", async () => {
    mockedStudioApi.getChannelPulse.mockResolvedValueOnce({
      success: false,
      message: "Connect YouTube to load channel pulse.",
    });
    render(<ChannelPulseModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Connect YouTube to load channel pulse.")).toBeTruthy();
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Subscribers")).toBeNull();
  });
});
