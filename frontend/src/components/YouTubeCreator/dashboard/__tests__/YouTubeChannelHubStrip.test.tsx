import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeChannelHubStrip } from "../YouTubeChannelHubStrip";

describe("YouTubeChannelHubStrip", () => {
  it("starts OAuth from the Connect control when disconnected", () => {
    const onConnect = vi.fn();

    render(
      <YouTubeChannelHubStrip
        connected={false}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect YouTube/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Swipe → to link/i)).toBeTruthy();
  });

  it("calls onDisconnect when connected", () => {
    const onDisconnect = vi.fn();

    render(
      <YouTubeChannelHubStrip
        connected
        channelName="Studio Channel"
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Disconnect YouTube/i }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Swipe ← to unlink/i)).toBeTruthy();
    expect(screen.getByText("Disconnect")).toBeTruthy();
  });

  it("does not allow disconnect when the handler is missing", () => {
    render(
      <YouTubeChannelHubStrip
        connected
        channelName="Studio Channel"
        onConnect={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: /Disconnect YouTube/i });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
  });

  it("shows disconnecting state while revoke is in flight", () => {
    render(
      <YouTubeChannelHubStrip
        connected
        channelName="Studio Channel"
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        isDisconnecting
      />,
    );

    const busyLabels = screen.getAllByText("Disconnecting…");
    expect(busyLabels).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Disconnect YouTube/i })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
