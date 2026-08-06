/**
 * PublishLinkedInLimitCaption — post char vs article word labels.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=PublishLinkedInLimitCaption
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  PublishLinkedInLimitCaption,
  resolvePublishLimitHeaderLabel,
} from "../components/PublishLinkedInLimitCaption";

jest.mock("../utils/linkedInWriterUtils", () => ({
  readPrefs: jest.fn(() => ({ word_count: 1500 })),
}));

describe("PublishLinkedInLimitCaption", () => {
  test("post content type shows character limit label", () => {
    render(
      <PublishLinkedInLimitCaption
        plainText={"Hello LinkedIn".repeat(10)}
        contentType="post"
      />,
    );

    expect(screen.getByText(/\/ 3000$/)).toBeTruthy();
    expect(screen.queryByText(/words/)).toBeNull();
  });

  test("article content type shows word count label", () => {
    render(
      <PublishLinkedInLimitCaption
        plainText="one two three four five"
        contentType="article"
        targetWordCount={800}
      />,
    );

    expect(screen.getByText(/5 \/ 800 words/)).toBeTruthy();
    expect(screen.queryByText(/\/ 3000/)).toBeNull();
  });

  test("resolvePublishLimitHeaderLabel for article", () => {
    const header = resolvePublishLimitHeaderLabel(
      "word ".repeat(20).trim(),
      "article",
      800,
    );
    expect(header.label).toBe("20 / 800 words");
  });

  test("resolvePublishLimitHeaderLabel for post", () => {
    const header = resolvePublishLimitHeaderLabel("Short post", "post");
    expect(header.label).toMatch(/\/ 3000$/);
  });
});
