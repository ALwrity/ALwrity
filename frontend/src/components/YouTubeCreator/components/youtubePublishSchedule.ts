/** Convert datetime-local input to YouTube publishAt ISO-8601 UTC. */
export function toYouTubePublishAtIso(localValue: string): string | undefined {
  if (!localValue.trim()) return undefined;
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}
