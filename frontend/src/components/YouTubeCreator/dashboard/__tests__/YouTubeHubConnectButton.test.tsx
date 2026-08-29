import { fireEvent, render, screen } from "@testing-library/react";
import { YouTubeHubConnectButton } from "../YouTubeHubConnectButton";
import { YOUTUBE_CONNECT_CTA, YOUTUBE_CREATE_VIDEO_CTA } from "../youtubeHubConnectUi";

describe("YouTubeHubConnectButton", () => {
  it("shows Connect YouTube and starts OAuth when disconnected", () => {
    const onConnect = vi.fn();
    const onCreateVideo = vi.fn();

    render(
      <YouTubeHubConnectButton
        connected={false}
        onConnect={onConnect}
        onCreateVideo={onCreateVideo}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: YOUTUBE_CONNECT_CTA }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onCreateVideo).not.toHaveBeenCalled();
  });

  it("shows Create Video instead of Disconnect when already connected", () => {
    const onConnect = vi.fn();
    const onCreateVideo = vi.fn();

    render(
      <YouTubeHubConnectButton
        connected
        onConnect={onConnect}
        onCreateVideo={onCreateVideo}
      />,
    );

    expect(screen.getByRole("button", { name: YOUTUBE_CREATE_VIDEO_CTA })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /disconnect/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: YOUTUBE_CREATE_VIDEO_CTA }));
    expect(onCreateVideo).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("disables the CTA while connection status is loading", () => {
    render(
      <YouTubeHubConnectButton
        connected={false}
        onConnect={vi.fn()}
        onCreateVideo={vi.fn()}
        isLoading
      />,
    );

    const button = screen.getByRole("button", { name: "Checking connection..." });
    expect(button).toHaveProperty("disabled", true);
  });

  it.todo(
    "desktop Studio Hub exposes a Disconnect control after YouTube is connected (hub CTA currently becomes Create Video)",
  );
});
