/**
 * LinkedInArticleLivePreview tests.
 * Run manually:
 *   npx vitest run LinkedInArticleLivePreview
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LinkedInArticleLivePreview } from "../components/LinkedInArticleLivePreview";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";

vi.mock("../components/LinkedInAuthenticatedImage", () => ({
  LinkedInAuthenticatedImage: ({ alt }: { alt: string }) => (
    <img data-testid="auth-image" alt={alt} />
  ),
}));

const sampleState: LinkedInArticleDraftState = {
  title: "Future of Remote Work",
  sections: [
    {
      id: "sec_1",
      heading: "Introduction",
      body: "Remote work is here to stay.",
    },
  ],
  imageSuggestions: [],
  readingTime: 3,
};

describe("LinkedInArticleLivePreview", () => {
  test("renders article card preview with title and reading time", () => {
    render(
      <LinkedInArticleLivePreview
        state={sampleState}
        draftMarkdown="# Future of Remote Work"
      />,
    );

    expect(screen.getByTestId("linkedin-article-live-preview")).toBeTruthy();
    expect(screen.getByText("Future of Remote Work")).toBeTruthy();
    expect(screen.getByText("3 min read")).toBeTruthy();
    expect(screen.getByText(/LinkedIn Article/i)).toBeTruthy();
  });
});
