/**
 * Shared text helpers for Performance Pulse → Quick Create payloads.
 */
import type { LinkedInPost } from "../../../../../../services/postAnalyticsApi";

export const MAX_TOPIC_LEN = 200;
export const MAX_BULLET_LEN = 110;
export const KEY_POINT_SEP = " / ";
export const GENERIC_TITLES = new Set(["post", "my post", "linkedin post"]);

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateWithEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

export function isHashtagOnlyBlock(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => word.startsWith("#"));
}

export function firstSentence(text: string, maxLen = MAX_BULLET_LEN): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";

  const match = normalized.match(/^(.+?[.!?…])(?:\s|$)/);
  const sentence = match?.[1]?.trim() ?? normalized;
  return truncateWithEllipsis(sentence, maxLen);
}

export function pushUniqueBullet(bullets: string[], candidate: string): void {
  const trimmed = candidate.trim();
  if (trimmed.length < 10) return;
  const lower = trimmed.toLowerCase();
  if (bullets.some((b) => b.toLowerCase() === lower)) return;
  bullets.push(trimmed);
}

export function extractContentBullets(post: LinkedInPost): string[] {
  const body = post.text?.trim() ?? "";
  if (!body) return [];

  const blocks = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const bullets: string[] = [];

  for (const block of blocks) {
    if (isHashtagOnlyBlock(block)) continue;
    pushUniqueBullet(bullets, firstSentence(block));
    if (bullets.length >= 3) break;
  }

  return bullets;
}

export function joinOutlineBullets(bullets: string[]): string {
  return bullets.slice(0, 4).join(KEY_POINT_SEP);
}

export function hasMeaningfulTitle(title?: string | null): boolean {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return false;
  return !GENERIC_TITLES.has(trimmed.toLowerCase());
}
