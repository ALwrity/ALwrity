/**
 * Load youtube.com/iframe_api once for Comment Reply Assistant embeds.
 */
describe("ensureYouTubeIframeApi", () => {
  beforeEach(() => {
    document.querySelectorAll("script").forEach((node) => node.remove());
    delete (window as Window & { YT?: unknown }).YT;
    delete (window as Window & { onYouTubeIframeAPIReady?: unknown })
      .onYouTubeIframeAPIReady;
    vi.resetModules();
  });

  it("resolves without inserting a script when YT.Player already exists", async () => {
    (window as Window & { YT: { Player: () => void } }).YT = {
      Player: function Player() {},
    };
    const { ensureYouTubeIframeApi } = await import("../youtubeIframeApi");

    await ensureYouTubeIframeApi();

    expect(
      document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
        .length,
    ).toBe(0);
  });

  it("does not insert a second iframe_api script while loading", async () => {
    const first = document.createElement("script");
    document.head.appendChild(first);
    const { ensureYouTubeIframeApi } = await import("../youtubeIframeApi");

    const pending = ensureYouTubeIframeApi();
    const again = ensureYouTubeIframeApi();

    expect(
      document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
        .length,
    ).toBe(1);

    (window as Window & { YT: { Player: () => void } }).YT = {
      Player: function Player() {},
    };
    window.onYouTubeIframeAPIReady?.();
    await Promise.all([pending, again]);
  });

  it("chains a prior onYouTubeIframeAPIReady callback", async () => {
    const prior = vi.fn();
    window.onYouTubeIframeAPIReady = prior;
    const first = document.createElement("script");
    document.head.appendChild(first);
    const { ensureYouTubeIframeApi } = await import("../youtubeIframeApi");

    const pending = ensureYouTubeIframeApi();
    (window as Window & { YT: { Player: () => void } }).YT = {
      Player: function Player() {},
    };
    window.onYouTubeIframeAPIReady?.();
    await pending;
    expect(prior).toHaveBeenCalled();
  });

  it("rejects when the iframe_api script fails to load", async () => {
    const first = document.createElement("script");
    document.head.appendChild(first);
    const { ensureYouTubeIframeApi, YOUTUBE_IFRAME_API_SRC } = await import(
      "../youtubeIframeApi"
    );
    const pending = ensureYouTubeIframeApi();
    const apiScript = document.querySelector(
      `script[src="${YOUTUBE_IFRAME_API_SRC}"]`,
    ) as HTMLScriptElement;
    apiScript.onerror?.(new Event("error"));
    await expect(pending).rejects.toThrow(/IFrame API failed to load/);
  });
});
