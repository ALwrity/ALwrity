import {
  mergeNetworkSuggestionsIntoCache,
  readGrowthCache,
  readGrowthCacheData,
  writeGrowthCache,
  GROWTH_CACHE_KEY,
} from "../components/dashboard/engagementWedgeGrowthCache";
import type { ConsolidatedGrowthResponse } from "../../../services/linkedInGrowthApi";

const mockConsolidated = (): ConsolidatedGrowthResponse => ({
  trending: null,
  network_suggestions: null,
  engagement_opportunities: null,
  viral_analysis: null,
  weekly_strategy: null,
  content_gaps: null,
  brand_scorecard: null,
  generated_at: "2026-01-01T00:00:00.000Z",
});

describe("engagementWedgeGrowthCache", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("writeGrowthCache and readGrowthCacheData round-trip", () => {
    const data = mockConsolidated();
    writeGrowthCache(data);
    expect(readGrowthCacheData()).toEqual(data);
    expect(readGrowthCache()?.cachedAt).toBeGreaterThan(0);
  });

  it("mergeNetworkSuggestionsIntoCache updates network section only", () => {
    const base = mockConsolidated();
    writeGrowthCache(base);

    const network = {
      suggestions: [
        {
          name: "Jane Doe",
          title: "VP Marketing",
          company: "Acme",
          why_connect: "Shared industry focus",
          suggested_note: "Hi Jane, I'd love to connect.",
          data_source_detail: "Exa result #1",
          confidence: "high" as const,
        },
      ],
      data_source_summary: "Grounded in profile + research",
      generated_at: "2026-02-01T00:00:00.000Z",
    };

    const merged = mergeNetworkSuggestionsIntoCache(network);
    expect(merged.network_suggestions).toEqual(network);
    expect(readGrowthCacheData()?.network_suggestions).toEqual(network);
    expect(sessionStorage.getItem(GROWTH_CACHE_KEY)).toContain("Jane Doe");
  });

  it("mergeNetworkSuggestionsIntoCache creates shell when cache missing", () => {
    const network = {
      suggestions: [],
      data_source_summary: "No verifiable people found",
      generated_at: "2026-02-01T00:00:00.000Z",
    };
    mergeNetworkSuggestionsIntoCache(network);
    expect(readGrowthCacheData()?.network_suggestions?.data_source_summary).toBe(
      "No verifiable people found",
    );
  });
});
