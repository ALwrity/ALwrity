/**
 * Official IFrame Player for Comment Reply Assistant (cue only, no autoplay).
 * https://developers.google.com/youtube/iframe_api_reference
 */
import React, { useEffect, useRef, useState } from "react";
import { isYouTubeIframeVideoId } from "./youtubeCommentEmbedVideoId";
import { userSafeYouTubeIframeError } from "./youtubeCommentIframeErrors";
import {
  ensureYouTubeIframeApi,
  type YouTubeIframeApiWindow,
  type YouTubeIframePlayer,
} from "./youtubeIframeApi";

const YOUTUBE_IFRAME_MIN_PX = 200;

function youtubeIframePlayerSize(widthPx: number): { width: number; height: number } {
  const width = Math.max(Math.floor(widthPx) || 480, YOUTUBE_IFRAME_MIN_PX);
  const height = Math.max(Math.round((width * 9) / 16), YOUTUBE_IFRAME_MIN_PX);
  return { width, height };
}

function stopYouTubeIframePlayer(player: YouTubeIframePlayer | null): void {
  if (!player) {
    return;
  }
  try {
    player.pauseVideo();
  } catch (pauseError) {
    console.warn("[YouTubeCommentIframe] pauseVideo failed", {
      errorName: pauseError instanceof Error ? pauseError.name : "Error",
    });
  }
  try {
    player.destroy();
  } catch (destroyError) {
    console.warn("[YouTubeCommentIframe] destroy failed", {
      errorName: destroyError instanceof Error ? destroyError.name : "Error",
    });
  }
}

export const YouTubeCommentIframePlayer: React.FC<{ videoId: string }> = ({
  videoId,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubeIframePlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isYouTubeIframeVideoId(videoId)) {
      return undefined;
    }
    const trimmedId = videoId.trim();
    let cancelled = false;

    const teardown = () => {
      const player = playerRef.current;
      playerRef.current = null;
      stopYouTubeIframePlayer(player);
    };

    window.addEventListener("pagehide", teardown);

    console.info("[YouTubeCommentIframe] Player start", {
      hasVideoId: true,
      videoIdLength: trimmedId.length,
    });

    void ensureYouTubeIframeApi()
      .then(() => {
        if (cancelled || !hostRef.current) {
          return;
        }
        const YT = (window as YouTubeIframeApiWindow).YT;
        if (!YT?.Player) {
          setError("This video could not be played here.");
          return;
        }
        const wrapWidth = wrapRef.current?.clientWidth || 480;
        const size = youtubeIframePlayerSize(wrapWidth);
        const player = new YT.Player(hostRef.current, {
          width: size.width,
          height: size.height,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return;
              }
              try {
                event.target.cueVideoById(trimmedId);
              } catch (cueError) {
                console.error("[YouTubeCommentIframe] cueVideoById failed", {
                  errorName: cueError instanceof Error ? cueError.name : "Error",
                });
                setError("This video could not be played here.");
              }
            },
            onError: (event) => {
              console.error("[YouTubeCommentIframe] Player error", {
                iframe_error_code: event.data,
                hasVideoId: true,
                videoIdLength: trimmedId.length,
              });
              setError(userSafeYouTubeIframeError(event.data));
            },
          },
        });
        if (cancelled) {
          stopYouTubeIframePlayer(player);
          return;
        }
        playerRef.current = player;
      })
      .catch((loadError) => {
        console.error("[YouTubeCommentIframe] API load failed", {
          errorName: loadError instanceof Error ? loadError.name : "Error",
        });
        if (!cancelled) {
          setError("This video could not be played here.");
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
  }, [videoId]);

  if (!isYouTubeIframeVideoId(videoId)) {
    return null;
  }

  return (
    <div
      className="yt-comment-iframe-wrap"
      data-testid="youtube-comment-iframe-player"
      ref={wrapRef}
    >
      {error ? <p className="yt-comment-iframe-error">{error}</p> : null}
      <div className="yt-comment-iframe-host" ref={hostRef} />
    </div>
  );
};
