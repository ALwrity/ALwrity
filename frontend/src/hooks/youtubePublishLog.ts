/**
 * Safe metadata for Video Creator publish logs.
 * Never log title, video URL, auth URL, or tokens.
 */

export type YouTubePublishSourceKind =
  | "empty"
  | "youtube_api_path"
  | "http"
  | "ftp"
  | "local_or_other";

export function youtubePublishSourceKind(
  source: string | null | undefined,
): YouTubePublishSourceKind {
  if (!source) return "empty";
  if (source.startsWith("/api/youtube/videos/")) return "youtube_api_path";
  if (source.startsWith("https://") || source.startsWith("http://")) return "http";
  if (source.startsWith("ftp://")) return "ftp";
  return "local_or_other";
}

export function youtubePublishSourceMeta(source: string | null | undefined): {
  sourceKind: YouTubePublishSourceKind;
  sourceLength: number;
} {
  return {
    sourceKind: youtubePublishSourceKind(source),
    sourceLength: source ? source.length : 0,
  };
}
