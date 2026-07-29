/**
 * Local filter for LinkedIn industry autocomplete (hybrid cache architecture).
 * Phase 1+: filters in-memory catalog as the user types — no per-keystroke API.
 */

export interface LinkedInIndustryItem {
  id: string;
  title: string;
}

const LOG_PREFIX = "[LinkedInIndustryFilter]";
export const LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH = 100;

/**
 * Case-insensitive substring match with prefix matches ranked first.
 */
export function filterLinkedInIndustries(
  items: LinkedInIndustryItem[],
  query: string,
  limit = 20,
): LinkedInIndustryItem[] {
  if (!Array.isArray(items)) {
    console.debug(`${LOG_PREFIX} invalid items — expected array`);
    return [];
  }

  const trimmed = (query || "").trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length > LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH) {
    console.debug(
      `${LOG_PREFIX} query exceeds max length (${LINKEDIN_INDUSTRY_MAX_QUERY_LENGTH}) — freestyle only`,
    );
    return [];
  }

  const lower = trimmed.toLowerCase();
  const safeLimit = Math.max(1, limit);

  try {
    const matches = items.filter((item) => {
      if (!item || typeof item.title !== "string") {
        return false;
      }
      return item.title.toLowerCase().includes(lower);
    });

    matches.sort((a, b) => {
      const aLower = a.title.toLowerCase();
      const bLower = b.title.toLowerCase();
      const aPrefix = aLower.startsWith(lower) ? 0 : 1;
      const bPrefix = bLower.startsWith(lower) ? 0 : 1;
      if (aPrefix !== bPrefix) {
        return aPrefix - bPrefix;
      }
      return a.title.localeCompare(b.title);
    });

    return matches.slice(0, safeLimit);
  } catch (error) {
    console.debug(`${LOG_PREFIX} filter failed`, error);
    return [];
  }
}
