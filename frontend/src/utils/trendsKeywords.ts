const TRENDS_STOPWORDS = new Set([
  "a", "an", "the", "for", "and", "or", "to", "of", "in", "on", "at", "by", "with", "from",
  "your", "our", "their", "this", "that", "how", "what", "about", "guide", "video",
  "targeting", "young", "professionals", "beginners", "complete", "ultimate",
]);

/** Convert long video ideas into short Google Trends-friendly search terms. */
export function normalizeTrendsKeywords(rawKeywords: string[], maxKeywords = 5): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (phrase: string) => {
    const cleaned = phrase.trim().replace(/\s+/g, " ").slice(0, 50);
    const key = cleaned.toLowerCase();
    if (cleaned && !seen.has(key) && result.length < maxKeywords) {
      seen.add(key);
      result.push(cleaned);
    }
  };

  for (const raw of rawKeywords) {
    const text = raw.trim();
    if (!text) continue;

    if (text.length <= 45 && text.split(/\s+/).length <= 4) {
      add(text);
      continue;
    }

    const tokens = text
      .match(/[A-Za-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !TRENDS_STOPWORDS.has(token.toLowerCase())) || [];

    if (tokens.length === 0) {
      add(text.slice(0, 45));
      continue;
    }

    add(tokens.slice(0, 3).join(" "));
    for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
      add(token);
      if (result.length >= maxKeywords) break;
    }
  }

  if (result.length === 0 && rawKeywords[0]?.trim()) {
    add(rawKeywords[0].trim().slice(0, 45));
  }

  return result.slice(0, maxKeywords);
}
