import type { ConsolidatedGrowthResponse } from "../../../../services/linkedInGrowthApi";
import type { PostCandidate } from "./PostTodayCandidateList";

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
    candidates.push({
      topic: item.topic,
      hook: item.suggested_hook || item.why_now || "",
      sourceLabel: index === 0 ? "Top Trending Topic" : "Trending Now",
      sourceIcon: "🔥",
      confidence: normalizeConfidence(item.confidence),
      score: scoreFor(item.confidence, "trending"),
      sourceType: "trending",
      emoji: item.emoji,
      context: item.why_now,
      hookLabel: "Hook idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const dailyPosts = c.weekly_strategy?.daily_posts ?? [];
  dailyPosts.forEach((post, index) => {
    if (!post?.headline?.trim()) return;
    candidates.push({
      topic: post.headline,
      hook: post.hook || post.why_this_works || "",
      sourceLabel: index === 0 ? "Today's Weekly Plan Pick" : `Weekly Plan · ${post.day || "Day"}`,
      sourceIcon: "📅",
      confidence: normalizeConfidence(post.confidence),
      score: scoreFor(post.confidence, "strategy"),
      sourceType: "strategy",
      context: post.why_this_works,
      hookLabel: "Hook idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const opportunities = c.engagement_opportunities?.opportunities ?? [];
  opportunities.forEach((item, index) => {
    if (!item?.title?.trim()) return;
    const contextParts = [item.author_context, item.why_engage].filter(Boolean);
    candidates.push({
      topic: item.title,
      hook: item.suggested_comment || item.why_engage || "",
      sourceLabel: index === 0 ? "Top Engagement Opportunity" : "Engagement Opportunity",
      sourceIcon: "💬",
      confidence: normalizeConfidence(item.confidence),
      score: scoreFor(item.confidence, "engagement"),
      sourceType: "engagement",
      context: contextParts.join(" — "),
      hookLabel: "Comment idea",
      actionLabel: "✍️ Create Post",
    });
  });

  const gaps = c.content_gaps?.gaps ?? [];
  gaps.forEach((gap, index) => {
    if (!gap?.gap_topic?.trim()) return;
    candidates.push({
      topic: gap.gap_topic,
      hook: gap.suggested_angle || gap.why_it_matters || "",
      sourceLabel: index === 0 ? "Biggest Content Gap" : "Content Gap",
      sourceIcon: "🔍",
      confidence: normalizeConfidence(gap.confidence),
      score: scoreFor(gap.confidence, "gaps"),
      sourceType: "content_gap",
      context: gap.why_it_matters || gap.why_gap,
      hookLabel: "Post angle",
      actionLabel: "✍️ Fill This Gap",
    });
  });

  const patterns = c.viral_analysis?.patterns ?? [];
  patterns.forEach((p, index) => {
    const topic = p.example_headline || p.pattern_name;
    if (!topic?.trim()) return;
    const contextParts = [
      p.pattern_name,
      p.engagement_multiplier ? `${p.engagement_multiplier} engagement` : "",
      p.example_author ? `Example by ${p.example_author}` : "",
    ].filter(Boolean);
    candidates.push({
      topic,
      hook: p.description || c.viral_analysis?.top_recommendation || "",
      sourceLabel: index === 0 ? "Top Viral Pattern" : "Viral Pattern",
      sourceIcon: "📈",
      confidence: normalizeConfidence(p.confidence),
      score: scoreFor(p.confidence, "viral"),
      sourceType: "viral",
      context: contextParts.join(" · "),
      hookLabel: "Pattern insight",
      actionLabel: "✍️ Write in This Style",
    });
  });

  const suggestions = c.network_suggestions?.suggestions ?? [];
  suggestions.forEach((s, index) => {
    if (!s?.name?.trim()) return;
    candidates.push({
      topic: `${s.name} — ${s.title || "Connection"}${s.company ? ` @ ${s.company}` : ""}`,
      hook: s.suggested_note || s.why_connect || "",
      sourceLabel: index === 0 ? "Top Network Suggestion" : "Network Suggestion",
      sourceIcon: "🤝",
      confidence: normalizeConfidence(s.confidence),
      score: scoreFor(s.confidence, "network"),
      sourceType: "network",
      context: s.why_connect,
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
      topic,
      hook: c.weekly_strategy?.focus_area || c.weekly_strategy?.theme || "",
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
      hook: c.viral_analysis.top_recommendation,
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
      hook: brand.top_recommendation,
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
