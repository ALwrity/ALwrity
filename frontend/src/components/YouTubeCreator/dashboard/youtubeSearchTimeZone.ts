/**
 * Resolve the viewer's IANA time zone for Search.list Upload Date.
 * Never hardcode a city; fall back to UTC if Intl is unavailable.
 */
export function resolveYouTubeSearchTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof timeZone === "string" && timeZone.trim()) {
      console.info("[youtubeSearchTimeZone] Resolved IANA time zone", {
        timeZone: timeZone.trim(),
      });
      return timeZone.trim();
    }
    console.warn("[youtubeSearchTimeZone] Empty IANA time zone, using UTC");
    return "UTC";
  } catch (error) {
    console.error("[youtubeSearchTimeZone] Failed to resolve IANA time zone", error);
    return "UTC";
  }
}
