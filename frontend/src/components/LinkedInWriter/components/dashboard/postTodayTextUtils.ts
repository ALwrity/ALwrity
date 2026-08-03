/** Normalize growth-signal copy for Post Today cards. */
export function sanitizePostTodayText(text: unknown): string {
  if (text == null) return "";
  let value = String(text).trim();
  if (!value) return "";

  // Strip wrapping quotes the LLM may include in hook fields.
  value = value.replace(/^["'""''`]+|["'""''`]+$/g, "");
  // Remove zero-width / invisible characters that break layout.
  value = value.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Collapse irregular whitespace (tabs, newlines, multiple spaces).
  value = value.replace(/\s+/g, " ").trim();

  return value;
}

/** True when hook text is present and distinct from the card context line. */
export function shouldShowHook(hook: string, context?: string): boolean {
  if (!hook) return false;
  if (!context) return true;
  return hook.toLowerCase() !== context.toLowerCase();
}
