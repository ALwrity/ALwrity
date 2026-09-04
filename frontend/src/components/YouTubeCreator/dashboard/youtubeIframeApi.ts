/**
 * Load the YouTube IFrame Player API once (SPA-safe).
 * https://developers.google.com/youtube/iframe_api_reference
 */

export const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
export const YOUTUBE_IFRAME_API_SCRIPT_ID = "youtube-iframe-api";

export type YouTubeIframePlayer = {
  cueVideoById: (videoId: string) => void;
  pauseVideo: () => void;
  destroy: () => void;
};

export type YouTubeIframePlayerOptions = {
  width?: number;
  height?: number;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubeIframePlayer }) => void;
    onError?: (event: { target: YouTubeIframePlayer; data: number }) => void;
  };
};

export type YouTubeIframeApiWindow = Window & {
  YT?: {
    Player: new (
      element: string | HTMLElement,
      options: YouTubeIframePlayerOptions,
    ) => YouTubeIframePlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
};

function youtubeIframeApiWindow(): YouTubeIframeApiWindow {
  return window as YouTubeIframeApiWindow;
}

function isYouTubeIframeApiReady(): boolean {
  return typeof youtubeIframeApiWindow().YT?.Player === "function";
}

let loadPromise: Promise<void> | null = null;

export function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API requires a browser"));
  }
  if (isYouTubeIframeApiReady()) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const win = youtubeIframeApiWindow();
    const previousReady = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } catch (readyError) {
        console.warn("[YouTubeCommentIframe] Prior onYouTubeIframeAPIReady failed", {
          errorName: readyError instanceof Error ? readyError.name : "Error",
        });
      }
      resolve();
    };

    if (document.getElementById(YOUTUBE_IFRAME_API_SCRIPT_ID)) {
      return;
    }

    const tag = document.createElement("script");
    tag.id = YOUTUBE_IFRAME_API_SCRIPT_ID;
    tag.src = YOUTUBE_IFRAME_API_SRC;
    tag.async = true;
    tag.onerror = () => {
      loadPromise = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(tag, firstScript);
    } else {
      document.head.appendChild(tag);
    }
  });

  return loadPromise;
}
