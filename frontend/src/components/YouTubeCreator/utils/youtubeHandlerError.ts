/**
 * Safe, user-facing error text for YouTube Creator handlers.
 * Does not log or return secrets, tokens, or raw payloads.
 */

export function youtubeHandlerErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  if (typeof err === "string" && err.trim()) {
    return err.trim();
  }
  return fallback;
}
