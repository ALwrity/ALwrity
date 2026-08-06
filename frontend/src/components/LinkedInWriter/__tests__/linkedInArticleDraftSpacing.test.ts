/**
 * Article section body spacing preservation in markdown round-trip.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=linkedInArticleDraftSpacing
 */

import {
  articleStateToMarkdown,
  parseMarkdownToArticleDraft,
} from "../utils/linkedInArticleDraftUtils";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";
import { createArticleSectionId } from "../utils/linkedInArticleDraftTypes";

describe("linkedInArticleDraftSpacing", () => {
  test("preserves manual line breaks inside section bodies", () => {
    const state: LinkedInArticleDraftState = {
      title: "Spacing Test",
      sections: [
        {
          id: createArticleSectionId(),
          heading: "Introduction",
          body: "First line\n\nSecond line",
        },
      ],
      imageSuggestions: [],
    };

    const markdown = articleStateToMarkdown(state);
    const reparsed = parseMarkdownToArticleDraft(markdown);

    expect(reparsed.sections[0].body).toBe("First line\n\nSecond line");
  });

  test("preserves tight single line breaks inside section bodies", () => {
    const state: LinkedInArticleDraftState = {
      title: "Tight Spacing",
      sections: [
        {
          id: createArticleSectionId(),
          heading: "Key Points",
          body: "Line one\nLine two\nLine three",
        },
      ],
      imageSuggestions: [],
    };

    const markdown = articleStateToMarkdown(state);
    const reparsed = parseMarkdownToArticleDraft(markdown);

    expect(reparsed.sections[0].body).toBe("Line one\nLine two\nLine three");
  });
});
