/**
 * Assistive citation hint normalization — no raw URLs in the editor.
 */

import {
  formatAssistiveSuggestionText,
  normalizeAssistiveCitationHints,
  resolveAssistiveSourceIndex,
  stripAssistiveCitationHints,
} from "../utils/linkedInAssistiveCitationUtils";

describe("linkedInAssistiveCitationUtils", () => {
  const sources = [
    {
      title: "Arclen headlines",
      url: "https://arclen.io/blog/headlines-losing-money-data",
      score: 0.9,
    },
    {
      title: "Other",
      url: "https://example.com/other",
      score: 0.5,
    },
  ];

  const raw =
    "Use data-driven headline formulas to double your LinkedIn shares ((Arclen, 2023)[https://arclen.io/blog/headlines-losing-money-data]).";

  it("resolves source index by URL", () => {
    expect(
      resolveAssistiveSourceIndex(
        "https://arclen.io/blog/headlines-losing-money-data/",
        sources,
      ),
    ).toBe(1);
    expect(
      resolveAssistiveSourceIndex("https://example.com/other", sources),
    ).toBe(2);
  });

  it("converts URL citation hints to [Source N]", () => {
    const normalized = normalizeAssistiveCitationHints(raw, sources);
    expect(normalized).toContain("[Source 1]");
    expect(normalized).not.toContain("https://");
    expect(normalized).not.toContain("((");
  });

  it("prefers researchSources index when URL matches there", () => {
    const research = [
      { title: "R1", url: "https://example.com/a" },
      {
        title: "Arclen",
        url: "https://arclen.io/blog/headlines-losing-money-data",
      },
    ];
    const normalized = normalizeAssistiveCitationHints(raw, sources, research);
    expect(normalized).toContain("[Source 2]");
  });

  it("strips URL hints when no sources are available", () => {
    const stripped = normalizeAssistiveCitationHints(raw, []);
    expect(stripped).not.toContain("https://");
    expect(stripped).not.toContain("[Source");
    expect(stripped).toContain("LinkedIn shares");
  });

  it("stripAssistiveCitationHints removes hints entirely", () => {
    expect(stripAssistiveCitationHints(raw)).not.toContain("https://");
    expect(stripAssistiveCitationHints(raw)).not.toContain("[Source");
  });

  it("formatAssistiveSuggestionText matches normalize for cards", () => {
    expect(formatAssistiveSuggestionText(raw, sources)).toBe(
      normalizeAssistiveCitationHints(raw, sources),
    );
  });
});
