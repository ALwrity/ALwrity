/**
 * articleLivePreviewUtils tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=articleLivePreviewUtils
 */

import {
  buildArticleLivePreviewFromMarkdown,
  buildArticleLivePreviewModel,
} from "../utils/articleLivePreviewUtils";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";

describe("articleLivePreviewUtils", () => {
  test("buildArticleLivePreviewModel uses title, intro excerpt, and hero image", () => {
    const state: LinkedInArticleDraftState = {
      title: "AI in Marketing",
      sections: [
        {
          id: "s1",
          heading: "Introduction",
          body: "AI is transforming how teams create content.",
        },
        {
          id: "s2",
          heading: "Trends",
          body: "Personalization is accelerating.",
        },
      ],
      images: [
        {
          id: "block-1",
          url: "https://example.com/hero.png",
          imageId: "img-1",
          alt: "Hero",
          markdown: "![Hero](https://example.com/hero.png)",
        },
      ],
      readingTime: 5,
      imageSuggestions: [],
    };

    const model = buildArticleLivePreviewModel(state);

    expect(model.title).toBe("AI in Marketing");
    expect(model.excerpt).toContain("AI is transforming");
    expect(model.readingTime).toBe(5);
    expect(model.sectionCount).toBe(2);
    expect(model.heroImage?.imageId).toBe("img-1");
  });

  test("buildArticleLivePreviewFromMarkdown parses title and excerpt", () => {
    const markdown = `# Remote Work Guide

## Introduction

Remote teams need async tools.

## Key Trends

Collaboration platforms are evolving.`;

    const model = buildArticleLivePreviewFromMarkdown(markdown);

    expect(model.title).toBe("Remote Work Guide");
    expect(model.excerpt).toContain("Remote teams");
    expect(model.sectionCount).toBeGreaterThanOrEqual(2);
  });
});
