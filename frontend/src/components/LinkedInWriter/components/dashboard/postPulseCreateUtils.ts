/**
 * Topic / key-points / reference mapping for Post Engagement Pulse → Quick Create.
 */
import type { LinkedInPost } from "../../../../services/postAnalyticsApi";

export type PostPulseCreateMode = "repurpose" | "write_more";

export interface PostPulseCreatePayload {
  topic: string;
  /** Slash-separated outline bullets for the Key Points field. */
  key_points: string;
  /** Hidden generation context — original post + creation intent. */
  reference_context: string;
  reference_mode: PostPulseCreateMode;
}

const MAX_TOPIC_LEN = 200;
const MAX_BULLET_LEN = 110;
const KEY_POINT_SEP = " / ";
const GENERIC_TITLES = new Set(["post", "my post", "linkedin post"]);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateWithEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

function isHashtagOnlyBlock(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => word.startsWith("#"));
}

function firstSentence(text: string, maxLen = MAX_BULLET_LEN): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";

  const match = normalized.match(/^(.+?[.!?…])(?:\s|$)/);
  const sentence = match?.[1]?.trim() ?? normalized;
  return truncateWithEllipsis(sentence, maxLen);
}

function pushUniqueBullet(bullets: string[], candidate: string): void {
  const trimmed = candidate.trim();
  if (trimmed.length < 10) return;
  const lower = trimmed.toLowerCase();
  if (bullets.some((b) => b.toLowerCase() === lower)) return;
  bullets.push(trimmed);
}

/** Extract 1–3 theme bullets from post body paragraphs. */
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

function structureBulletsForMode(mode: PostPulseCreateMode): string[] {
  if (mode === "repurpose") {
    return [
      "Fresh hook that leads into the core message",
      "Reframe the main insight for today's audience",
      "Close with an engagement-driving question",
    ];
  }
  return [
    "New angle on the same theme",
    "Match the reference post's tone and pacing",
    "End with a question that invites comments",
  ];
}

/** Outline bullets for the new post — slash-separated for Quick Create. */
export function buildOutlineKeyPoints(
  post: LinkedInPost,
  mode: PostPulseCreateMode,
): string {
  const contentBullets = extractContentBullets(post);
  const structureBullets = structureBulletsForMode(mode);
  const merged: string[] = [];

  for (const bullet of contentBullets) {
    pushUniqueBullet(merged, bullet);
    if (merged.length >= 2) break;
  }

  for (const bullet of structureBullets) {
    pushUniqueBullet(merged, bullet);
    if (merged.length >= 4) break;
  }

  if (merged.length === 0) {
    return structureBullets.slice(0, 3).join(KEY_POINT_SEP);
  }

  return merged.slice(0, 4).join(KEY_POINT_SEP);
}

/** First hook line or sentence from a LinkedIn post — used as Quick Create topic. */
export function extractPostTopic(post: LinkedInPost): string {
  const body = post.text?.trim() ?? "";
  if (body) {
    const firstLine =
      body.split(/\n+/).find((line) => line.trim())?.trim() ?? body;
    const normalized = normalizeWhitespace(firstLine);

    if (normalized.length <= MAX_TOPIC_LEN) {
      return normalized;
    }

    const sentenceMatch = normalized
      .slice(0, MAX_TOPIC_LEN)
      .match(/^(.+?[.!?…—–-])(?:\s|$)/);
    if (sentenceMatch?.[1]) {
      return truncateWithEllipsis(sentenceMatch[1].trim(), MAX_TOPIC_LEN);
    }

    return truncateWithEllipsis(normalized, MAX_TOPIC_LEN);
  }

  const title = post.title?.trim() ?? "";
  if (title && !GENERIC_TITLES.has(title.toLowerCase())) {
    return truncateWithEllipsis(title, MAX_TOPIC_LEN);
  }

  return "LinkedIn post";
}

/** Reference post + intent — passed to generation, not shown in Key Points. */
export function buildReferenceContext(
  post: LinkedInPost,
  mode: PostPulseCreateMode,
): string {
  const original = post.text?.trim() ?? "";
  const intent =
    mode === "repurpose"
      ? "CREATION INTENT: Repurpose this winning post into fresh LinkedIn content. Preserve the core message and engagement patterns but use a new hook, wording, and structure. Do NOT copy verbatim."
      : "CREATION INTENT: Write more content like this reference post. Match tone, paragraph rhythm, and engagement style while exploring a new angle on the same theme. Do NOT copy verbatim.";

  if (!original) return intent;
  return `${intent}\n\nREFERENCE POST:\n${original}`;
}

export function buildPostPulseCreatePayload(
  post: LinkedInPost,
  mode: PostPulseCreateMode,
): PostPulseCreatePayload {
  return {
    topic: extractPostTopic(post),
    key_points: buildOutlineKeyPoints(post, mode),
    reference_context: buildReferenceContext(post, mode),
    reference_mode: mode,
  };
}
