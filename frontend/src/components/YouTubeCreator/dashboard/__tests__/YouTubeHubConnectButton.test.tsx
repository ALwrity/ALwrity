import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeHubConnectButton } from "../YouTubeHubConnectButton";
import { YOUTUBE_CONNECT_CTA, YOUTUBE_CREATE_VIDEO_CTA } from "../youtubeHubConnectUi";

/** LinkedIn hub-axis parity: Connect ⚡ when off, Disconnect when on. */
const YOUTUBE_DISCONNECT_CTA = /Disconnect YouTube/i;

function renderHubCta(
  overrides: Record<string, unknown> = {},
) {
  const props = {
    connected: false,
    onConnect: vi.fn(),
    onCreateVideo: vi.fn(),
    onDisconnect: vi.fn(),
    ...overrides,
  };
  render(<YouTubeHubConnectButton {...(props as never)} />);
  return props;
}

describe("YouTubeHubConnectButton", () => {
  it("shows Connect YouTube and starts OAuth when disconnected", () => {
    const props = renderHubCta();

    fireEvent.click(screen.getByRole("button", { name: YOUTUBE_CONNECT_CTA }));
    expect(props.onConnect).toHaveBeenCalledTimes(1);
    expect(props.onDisconnect).not.toHaveBeenCalled();
  });

  it("shows Disconnect YouTube and unlinks when already connected", () => {
    const props = renderHubCta({ connected: true });

    const disconnect = screen.getByRole("button", { name: YOUTUBE_DISCONNECT_CTA });
    expect(disconnect).toBeTruthy();
    expect(screen.queryByRole("button", { name: YOUTUBE_CREATE_VIDEO_CTA })).toBeNull();

    fireEvent.click(disconnect);
    expect(props.onDisconnect).toHaveBeenCalledTimes(1);
    expect(props.onConnect).not.toHaveBeenCalled();
    expect(props.onCreateVideo).not.toHaveBeenCalled();
  });

  it("disables the CTA while connection status is loading", () => {
    renderHubCta({ isLoading: true });

    const button = screen.getByRole("button", { name: "Checking connection..." });
    expect(button).toHaveProperty("disabled", true);
  });

  it("disables the CTA and shows Disconnecting while revoke is in flight", () => {
    renderHubCta({ connected: true, isDisconnecting: true });

    const button = screen.getByRole("button", { name: /Disconnecting/i });
    expect(button).toHaveProperty("disabled", true);
  });
});
