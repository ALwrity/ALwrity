/**
 * linkedInArticleDraftUtils unit tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInArticleDraftUtils
 */

import type { ArticleContent } from "../../../services/linkedInWriterApi";
import {
  articleResponseToDraftState,
  articleStateToMarkdown,
  buildArticleDraftUpdate,
  parseMarkdownToArticleDraft,
  splitMarkdownIntoSections,
} from "../utils/linkedInArticleDraftUtils";

describe("linkedInArticleDraftUtils", () => {
  const sampleApiData: ArticleContent = {
    title: "AI in Enterprise",
    content: "Intro paragraph here.\n\nMore context.",
    word_count: 120,
    sections: [
      { heading: "Current Landscape", body: "Enterprises are adopting AI fast." },
      { heading: "Next Steps", body: "Start with a pilot program." },
    ],
    image_suggestions: [
      { description: "Office with AI dashboard", alt_text: "Enterprise AI" },
    ],
    reading_time: 5,
  };

  test("articleResponseToDraftState maps API sections", () => {
    const state = articleResponseToDraftState(sampleApiData);
    expect(state.title).toBe("AI in Enterprise");
    expect(state.sections.length).toBeGreaterThanOrEqual(2);
    expect(state.sections.some((s) => s.heading === "Introduction")).toBe(true);
    expect(state.sections.some((s) => s.heading === "Current Landscape")).toBe(
      true,
    );
    expect(state.intro).toBeUndefined();
    expect(state.imageSuggestions).toHaveLength(1);
    expect(state.readingTime).toBe(5);
  });

  test("articleStateToMarkdown roundtrip structure", () => {
    const { state, markdown } = buildArticleDraftUpdate(sampleApiData);
    expect(markdown).toContain("# AI in Enterprise");
    expect(markdown).toContain("## Current Landscape");
    expect(markdown).toContain("Enterprises are adopting AI fast.");

    const reparsed = parseMarkdownToArticleDraft(markdown);
    expect(reparsed.title).toBe(state.title);
    expect(reparsed.sections.length).toBeGreaterThanOrEqual(2);
  });

  test("splitMarkdownIntoSections parses ## headings", () => {
    const sections = splitMarkdownIntoSections(
      "## One\n\nBody one\n\n## Two\n\nBody two",
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("One");
    expect(sections[1].body).toContain("Body two");
  });

  test("parseMarkdownToArticleDraft legacy flat draft", () => {
    const state = parseMarkdownToArticleDraft(
      "# Legacy Title\n\nSingle paragraph body without sections.",
    );
    expect(state.title).toBe("Legacy Title");
    expect(state.sections.length).toBeGreaterThanOrEqual(1);
  });

  test("buildArticleDraftUpdate returns state and markdown", () => {
    const result = buildArticleDraftUpdate(sampleApiData);
    expect(result.state.title).toBe("AI in Enterprise");
    expect(result.markdown.startsWith("# AI in Enterprise")).toBe(true);
  });
});
