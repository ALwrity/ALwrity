import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import { engagementScore } from "../remarkWedgeShared/postMetrics";

export interface RemixIdea {
  topic: string;
  angle: string;
  sourcePost: string;
}

export function extractWinningTopics(posts: LinkedInPost[]): string[] {
  const words = posts
    .flatMap((p) => p.text.split(/\s+/).slice(0, 20))
    .filter((w) => w.length > 4 && !/^(https?|www\.|#)/.test(w))
    .map((w) => w.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase());
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
}

export function buildRemixIdeas(posts: LinkedInPost[]): RemixIdea[] {
  const topPosts = [...posts]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5);
  return topPosts.map((p) => {
    const sentences = p.text.split(/[.!?]/);
    const topic = (p.title ?? sentences[0] ?? "").slice(0, 80).trim();
    const angle = sentences[1]?.trim().slice(0, 100) ?? p.text.slice(0, 100);
    return { topic, angle, sourcePost: p.text.slice(0, 200) };
  });
}
