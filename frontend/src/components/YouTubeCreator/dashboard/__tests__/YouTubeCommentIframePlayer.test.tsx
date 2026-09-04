/**
 * Comment Reply Assistant IFrame player: cue only, no autoplay, destroy on leave.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { YouTubeCommentIframePlayer } from "../YouTubeCommentIframePlayer";
import type { YouTubeIframePlayer } from "../youtubeIframeApi";

const cueVideoById = vi.fn();
const pauseVideo = vi.fn();
const destroy = vi.fn();
const playVideo = vi.fn();

let lastPlayerOptions: {
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubeIframePlayer }) => void;
    onError?: (event: { target: YouTubeIframePlayer; data: number }) => void;
  };
} | null = null;

vi.mock("../youtubeIframeApi", async () => {
  const actual = await vi.importActual<typeof import("../youtubeIframeApi")>(
    "../youtubeIframeApi",
  );
  return {
    ...actual,
    ensureYouTubeIframeApi: vi.fn(() => Promise.resolve()),
  };
});

class MockPlayer {
  cueVideoById = cueVideoById;
  pauseVideo = pauseVideo;
  destroy = destroy;
  playVideo = playVideo;

  constructor(
    _element: HTMLElement,
    options: {
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubeIframePlayer }) => void;
        onError?: (event: { target: YouTubeIframePlayer; data: number }) => void;
      };
    },
  ) {
    lastPlayerOptions = options;
    options.events?.onReady?.({ target: this });
  }
}

describe("YouTubeCommentIframePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPlayerOptions = null;
    (window as Window & { YT: { Player: typeof MockPlayer } }).YT = {
      Player: MockPlayer,
    };
  });

  it("cues the video without autoplay or playVideo", async () => {
    render(<YouTubeCommentIframePlayer videoId="abcdefghijk" />);

    await waitFor(() => {
      expect(cueVideoById).toHaveBeenCalledWith("abcdefghijk");
    });
    expect(playVideo).not.toHaveBeenCalled();
    expect(lastPlayerOptions?.playerVars?.autoplay).toBe(0);
    expect(lastPlayerOptions?.playerVars?.playsinline).toBe(1);
    expect(lastPlayerOptions?.playerVars?.origin).toBe(window.location.origin);
    expect(screen.getByTestId("youtube-comment-iframe-player")).toBeTruthy();
  });

  it("does not construct a player for an invalid video id", async () => {
    const { container } = render(<YouTubeCommentIframePlayer videoId="vid-1" />);
    await Promise.resolve();
    expect(cueVideoById).not.toHaveBeenCalled();
    expect(screen.queryByTestId("youtube-comment-iframe-player")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("pauses and destroys the player on pagehide", async () => {
    render(<YouTubeCommentIframePlayer videoId="abcdefghijk" />);
    await waitFor(() => expect(cueVideoById).toHaveBeenCalled());

    window.dispatchEvent(new Event("pagehide"));

    expect(pauseVideo).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it("pauses and destroys the player on unmount", async () => {
    const view = render(<YouTubeCommentIframePlayer videoId="abcdefghijk" />);
    await waitFor(() => expect(cueVideoById).toHaveBeenCalled());

    view.unmount();

    expect(pauseVideo).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it("shows a user-safe message on iframe error 101", async () => {
    render(<YouTubeCommentIframePlayer videoId="abcdefghijk" />);
    await waitFor(() => expect(lastPlayerOptions?.events?.onError).toBeTruthy());

    lastPlayerOptions?.events?.onError?.({
      target: {
        cueVideoById,
        pauseVideo,
        destroy,
      },
      data: 101,
    });

    await waitFor(() => {
      expect(
        screen.getByText("This video cannot be played here."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/101/)).toBeNull();
  });

  it("shows a user-safe message when YT.Player is missing", async () => {
    delete (window as Window & { YT?: unknown }).YT;
    render(<YouTubeCommentIframePlayer videoId="abcdefghijk" />);
    await waitFor(() => {
      expect(
        screen.getByText("This video could not be played here."),
      ).toBeTruthy();
    });
    expect(cueVideoById).not.toHaveBeenCalled();
  });
});
