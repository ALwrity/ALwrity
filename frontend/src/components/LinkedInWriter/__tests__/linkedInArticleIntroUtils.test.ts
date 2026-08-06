/**
 * linkedInArticleIntroUtils unit tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInArticleIntroUtils
 */

import type { LinkedInArticleSection } from "../utils/linkedInArticleDraftUtils";
import {
  extractLeadingIntroFromContent,
  isIntroductionSection,
  mergeIntroIntoSections,
  normalizeArticleDraftState,
} from "../utils/linkedInArticleIntroUtils";
import {
  articleResponseToDraftState,
  articleStateToMarkdown,
} from "../utils/linkedInArticleDraftUtils";
import type { ArticleContent } from "../../../services/linkedInWriterApi";

describe("linkedInArticleIntroUtils", () => {
  test("isIntroductionSection detects first introduction section", () => {
    const section: LinkedInArticleSection = {
      id: "s1",
      heading: "Introduction",
      body: "Hello",
    };
    expect(isIntroductionSection(section, 0)).toBe(true);
    expect(isIntroductionSection(section, 1)).toBe(false);
  });

  test("mergeIntroIntoSections prepends introduction when missing", () => {
    const sections: LinkedInArticleSection[] = [
      { id: "s1", heading: "Trends", body: "Body one" },
    ];
    const merged = mergeIntroIntoSections("Opening hook.", sections);
    expect(merged).toHaveLength(2);
    expect(merged[0].heading).toBe("Introduction");
    expect(merged[0].body).toBe("Opening hook.");
  });

  test("mergeIntroIntoSections merges into existing introduction section", () => {
    const sections: LinkedInArticleSection[] = [
      { id: "s1", heading: "Introduction", body: "Existing intro." },
      { id: "s2", heading: "Trends", body: "Body" },
    ];
    const merged = mergeIntroIntoSections("Legacy intro.", sections);
    expect(merged[0].body).toContain("Legacy intro.");
    expect(merged[0].body).toContain("Existing intro.");
  });

  test("normalizeArticleDraftState clears legacy intro field", () => {
    const normalized = normalizeArticleDraftState({
      title: "Test",
      intro: "Standalone intro.",
      sections: [{ id: "s1", heading: "One", body: "Section body" }],
      imageSuggestions: [],
    });
    expect(normalized.intro).toBeUndefined();
    expect(normalized.sections[0].heading).toBe("Introduction");
    expect(normalized.sections[0].body).toBe("Standalone intro.");
  });

  test("extractLeadingIntroFromContent reads short intro-only API content", () => {
    const content = "Intro paragraph here.\n\nMore context.";
    const sections: LinkedInArticleSection[] = [
      { id: "s1", heading: "Current Landscape", body: "Enterprises are adopting AI fast." },
      { id: "s2", heading: "Next Steps", body: "Start with a pilot program." },
    ];
    expect(extractLeadingIntroFromContent(content, sections)).toBe(content);
  });

  test("extractLeadingIntroFromContent reads prose before first heading", () => {
    const content =
      "Lead paragraph.\n\nMore context.\n\n## First Section\n\nSection body.";
    const sections: LinkedInArticleSection[] = [
      { id: "s1", heading: "First Section", body: "Section body." },
    ];
    expect(extractLeadingIntroFromContent(content, sections)).toBe(
      "Lead paragraph.\n\nMore context.",
    );
  });

  test("articleStateToMarkdown serializes introduction without H2", () => {
    const markdown = articleStateToMarkdown({
      title: "My Article",
      sections: [
        { id: "s1", heading: "Introduction", body: "Opening lines." },
        { id: "s2", heading: "Details", body: "Main content." },
      ],
      imageSuggestions: [],
    });
    expect(markdown).toContain("Opening lines.");
    expect(markdown).toContain("## Details");
    expect(markdown).not.toMatch(/## Introduction/);
  });

  test("articleResponseToDraftState folds API intro into sections", () => {
    const data: ArticleContent = {
      title: "AI Article",
      content:
        "Intro from API.\n\nMore intro.\n\n## Section One\n\nBody text.",
      word_count: 50,
      sections: [{ heading: "Section One", body: "Body text." }],
      image_suggestions: [],
    };
    const state = articleResponseToDraftState(data);
    expect(state.intro).toBeUndefined();
    expect(state.sections[0].heading).toBe("Introduction");
    expect(state.sections[0].body).toContain("Intro from API.");
    expect(state.sections[1].heading).toBe("Section One");
  });
});
