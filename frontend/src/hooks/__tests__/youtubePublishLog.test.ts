import { youtubePublishSourceKind, youtubePublishSourceMeta } from "../youtubePublishLog";

describe("youtubePublishSourceKind", () => {
  it("classifies Creator render paths, http, empty, and other", () => {
    expect(youtubePublishSourceKind("/api/youtube/videos/final.mp4")).toBe(
      "youtube_api_path",
    );
    expect(youtubePublishSourceKind("https://cdn.example/video.mp4")).toBe("http");
    expect(youtubePublishSourceKind("http://cdn.example/video.mp4")).toBe("http");
    expect(youtubePublishSourceKind("ftp://files.example/video.mp4")).toBe("ftp");
    expect(youtubePublishSourceKind("")).toBe("empty");
    expect(youtubePublishSourceKind(null)).toBe("empty");
    expect(youtubePublishSourceKind("C:\\\\videos\\\\final.mp4")).toBe("local_or_other");
  });
});

describe("youtubePublishSourceMeta", () => {
  it("returns kind and length without exposing the source string", () => {
    const meta = youtubePublishSourceMeta("/api/youtube/videos/final.mp4");
    expect(meta).toEqual({
      sourceKind: "youtube_api_path",
      sourceLength: "/api/youtube/videos/final.mp4".length,
    });
    expect(JSON.stringify(meta)).not.toContain("final.mp4");
  });
});
