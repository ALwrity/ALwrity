import type { ConsolidatedGrowthResponse } from "../../../../services/linkedInGrowthApi";
import type { PostCandidate } from "./PostTodayCandidateList";
import { sanitizePostTodayText } from "./postTodayTextUtils";

const CARD_PRIORITY: Record<string, number> = {
  trending: 0.5,
  strategy: 0.4,
  engagement: 0.3,
  gaps: 0.2,
  viral: 0.1,
  network: 0,
  brand: 0.05,
};
const SCORE_MAP: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  const level = String(value ?? "medium").toLowerCase();
  if (level === "high" || level === "medium" || level === "low") return level;
  return "medium";
}

function scoreFor(confidence: unknown, priorityKey: string): number {
  const level = normalizeConfidence(confidence);
  return (SCORE_MAP[level] ?? 1) + (CARD_PRIORITY[priorityKey] ?? 0);
}

/** True when at least one post recommendation can be built from growth data. */
export function isGrowthDataUsable(data: ConsolidatedGrowthResponse | null | undefined): boolean {
  if (!data) return false;
  return rankCandidates(data).length > 0;
}

export function rankCandidates(c: ConsolidatedGrowthResponse): PostCandidate[] {
  const candidates: PostCandidate[] = [];

  const trending = c.trending?.trending_topics ?? [];
  trending.forEach((item, index) => {
    if (!item?.topic?.trim()) return;
    const context = sanitizePostTodayText(item.why_now);
    candidates.push({
      topic: sanitizePostTodayText(item.topic),
      hook: sanitizePostTodayText(item.suggested_hook),
      sourceLabel: index === 0 ? "Top Trending Topic" : "Trending Now",
      sourceIcon: "🔥",
      confidence: normalizeConfidence(item.confidence),
      score: scoreFor(item.confidence, "trending"),
      sourceType: "trending",
      emoji: item.emoji,
      context: context || undefined,
      hookLabel: "Hook idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const dailyPosts = c.weekly_strategy?.daily_posts ?? [];
  dailyPosts.forEach((post, index) => {
    if (!post?.headline?.trim()) return;
    const context = sanitizePostTodayText(post.why_this_works);
    candidates.push({
      topic: sanitizePostTodayText(post.headline),
      hook: sanitizePostTodayText(post.hook),
      sourceLabel: index === 0 ? "Today's Weekly Plan Pick" : `Weekly Plan · ${post.day || "Day"}`,
      sourceIcon: "📅",
      confidence: normalizeConfidence(post.confidence),
      score: scoreFor(post.confidence, "strategy"),
      sourceType: "strategy",
      context: context || undefined,
      hookLabel: "Hook idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const opportunities = c.engagement_opportunities?.opportunities ?? [];
  opportunities.forEach((item, index) => {
    if (!item?.title?.trim()) return;
    const contextParts = [item.author_context, item.why_engage]
      .map((part) => sanitizePostTodayText(part))
      .filter(Boolean);
    candidates.push({
      topic: sanitizePostTodayText(item.title),
      hook: sanitizePostTodayText(item.suggested_comment),
      sourceLabel: index === 0 ? "Top Engagement Opportunity" : "Engagement Opportunity",
      sourceIcon: "💬",
      confidence: normalizeConfidence(item.confidence),
      score: scoreFor(item.confidence, "engagement"),
      sourceType: "engagement",
      context: contextParts.length > 0 ? contextParts.join(" — ") : undefined,
      hookLabel: "Comment idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const gaps = c.content_gaps?.gaps ?? [];
  gaps.forEach((gap, index) => {
    if (!gap?.gap_topic?.trim()) return;
    const context = sanitizePostTodayText(gap.why_it_matters || gap.why_gap);
    candidates.push({
      topic: sanitizePostTodayText(gap.gap_topic),
      hook: sanitizePostTodayText(gap.suggested_angle),
      sourceLabel: index === 0 ? "Biggest Content Gap" : "Content Gap",
      sourceIcon: "🔍",
      confidence: normalizeConfidence(gap.confidence),
      score: scoreFor(gap.confidence, "gaps"),
      sourceType: "content_gap",
      context: context || undefined,
      hookLabel: "Post angle",
      actionLabel: "✍️ Fill This Gap",
    });
  });

  const patterns = c.viral_analysis?.patterns ?? [];
  patterns.forEach((p, index) => {
    const topic = sanitizePostTodayText(p.example_headline || p.pattern_name);
    if (!topic) return;
    const contextParts = [
      sanitizePostTodayText(p.pattern_name),
      p.engagement_multiplier ? `${p.engagement_multiplier} engagement` : "",
      p.example_author ? `Example by ${sanitizePostTodayText(p.example_author)}` : "",
    ].filter(Boolean);
    candidates.push({
      topic,
      hook: sanitizePostTodayText(p.description || c.viral_analysis?.top_recommendation),
      sourceLabel: index === 0 ? "Top Viral Pattern" : "Viral Pattern",
      sourceIcon: "📈",
      confidence: normalizeConfidence(p.confidence),
      score: scoreFor(p.confidence, "viral"),
      sourceType: "viral",
      context: contextParts.length > 0 ? contextParts.join(" · ") : undefined,
      hookLabel: "Pattern insight",
      actionLabel: "✍️ Write in This Style",
    });
  });

  const suggestions = c.network_suggestions?.suggestions ?? [];
  suggestions.forEach((s, index) => {
    if (!s?.name?.trim()) return;
    const name = sanitizePostTodayText(s.name);
    const title = sanitizePostTodayText(s.title || "Connection");
    const company = sanitizePostTodayText(s.company);
    candidates.push({
      topic: `${name} — ${title}${company ? ` @ ${company}` : ""}`,
      hook: sanitizePostTodayText(s.suggested_note),
      sourceLabel: index === 0 ? "Top Network Suggestion" : "Network Suggestion",
      sourceIcon: "🤝",
      confidence: normalizeConfidence(s.confidence),
      score: scoreFor(s.confidence, "network"),
      sourceType: "network",
      context: sanitizePostTodayText(s.why_connect) || undefined,
      hookLabel: "Connection note",
      actionLabel: "✍️ Create Post",
    });
  });

  // Fallbacks when primary arrays are empty but other growth signals exist
  const keyTopics = c.weekly_strategy?.key_topics ?? [];
  keyTopics.forEach((topic, index) => {
    if (!topic?.trim()) return;
    if (candidates.some((x) => x.topic === topic)) return;
    candidates.push({
      topic: sanitizePostTodayText(topic),
      hook: sanitizePostTodayText(c.weekly_strategy?.focus_area || c.weekly_strategy?.theme),
      sourceLabel: index === 0 ? "Weekly Strategy Topic" : "Strategy Topic",
      sourceIcon: "📅",
      confidence: "medium",
      score: scoreFor("medium", "strategy"),
      sourceType: "strategy",
      context: c.weekly_strategy?.theme
        ? `Weekly theme: ${c.weekly_strategy.theme}`
        : undefined,
      hookLabel: "Focus area",
      actionLabel: "✍️ Create Post",
    });
  });

  if (
    c.viral_analysis?.top_recommendation?.trim() &&
    !candidates.some((x) => x.hook === c.viral_analysis?.top_recommendation)
  ) {
    candidates.push({
      topic: "Viral content opportunity",
      hook: sanitizePostTodayText(c.viral_analysis.top_recommendation),
      sourceLabel: "Viral Pattern Insight",
      sourceIcon: "📈",
      confidence: "medium",
      score: scoreFor("medium", "viral"),
      sourceType: "viral",
      context: c.viral_analysis.industry
        ? `Trending formats in ${c.viral_analysis.industry}`
        : undefined,
      hookLabel: "Top recommendation",
      actionLabel: "✍️ Write in This Style",
    });
  }

  const brand = c.brand_scorecard;
  if (brand?.top_recommendation?.trim()) {
    candidates.push({
      topic: "Strengthen your personal brand",
      hook: sanitizePostTodayText(brand.top_recommendation),
      sourceLabel: "Brand Score Insight",
      sourceIcon: "🏆",
      confidence: "medium",
      score: scoreFor("medium", "brand"),
      context:
        brand.overall_score > 0
          ? `Your brand score: ${brand.overall_score}/100`
          : undefined,
      hookLabel: "Recommendation",
      actionLabel: "✍️ Create Post",
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
