/**
 * Assistive citation hint normalization — no raw URLs or [Source N] in editor.
 */

import {
  formatAssistiveSuggestionText,
  normalizeAssistiveCitationHints,
  prepareAssistiveTextForEditor,
  resolveAssistiveSourceIndex,
  stripAssistiveCitationHints,
  stripAssistiveSourceMarkers,
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

  it("converts URL citation hints to [Source N] (legacy normalize)", () => {
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

  it("stripAssistiveSourceMarkers removes [Source N]", () => {
    const withMarker = "Great insight [Source 1] for leaders.";
    expect(stripAssistiveSourceMarkers(withMarker)).toBe(
      "Great insight for leaders.",
    );
  });

  it("prepareAssistiveTextForEditor strips URLs and [Source N]", () => {
    const withBoth =
      "Shares rise ((Arclen)[https://arclen.io/x]) [Source 1] today.";
    const cleaned = prepareAssistiveTextForEditor(withBoth);
    expect(cleaned).not.toContain("https://");
    expect(cleaned).not.toContain("[Source");
    expect(cleaned).toContain("Shares rise");
    expect(cleaned).toContain("today.");
  });

  it("formatAssistiveSuggestionText uses editor-safe cleaning", () => {
    const withMarker = "Tip [Source 2] here.";
    expect(formatAssistiveSuggestionText(withMarker, sources)).toBe(
      "Tip here.",
    );
  });
});
