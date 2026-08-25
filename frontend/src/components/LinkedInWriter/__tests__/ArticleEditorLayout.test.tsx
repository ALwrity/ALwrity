/**
 * ArticleEditorLayout smoke tests.
 * Run manually:
 *   npx vitest run ArticleEditorLayout
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ArticleEditorLayout } from "../components/ArticleEditor/ArticleEditorLayout";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";

const sampleState: LinkedInArticleDraftState = {
  title: "Future of Remote Work",
  sections: [
    {
      id: "sec_1",
      heading: "Introduction",
      body: "Remote work is here to stay.",
    },
    {
      id: "sec_2",
      heading: "Key Trends",
      body: "Async collaboration tools are growing.",
    },
  ],
  imageSuggestions: [],
  readingTime: 4,
};

describe("ArticleEditorLayout", () => {
  test("renders title field and section panel without cover block", () => {
    render(
      <ArticleEditorLayout
        state={sampleState}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("article-editor-layout")).toBeTruthy();
    expect(screen.getByTestId("article-title-field")).toBeTruthy();
    expect(screen.queryByTestId("article-cover-block")).toBeNull();
    expect(screen.getByTestId("article-section-panel")).toBeTruthy();
    expect(screen.getByTestId("article-section-body-editor")).toBeTruthy();
    expect(screen.getByTestId("article-editor-toolbar")).toBeTruthy();
    expect(screen.getByText(/Article sections/i)).toBeTruthy();
    expect(screen.queryByText(/Edit body/i)).toBeNull();
    expect(screen.queryByText(/Add post text first/i)).toBeNull();
  });

  test("does not render a separate intro field when legacy intro exists", () => {
    const onChange = vi.fn();
    render(
      <ArticleEditorLayout
        state={{
          ...sampleState,
          intro: "Legacy intro paragraph that should merge into sections.",
        }}
        onChange={onChange}
      />,
    );

    expect(
      screen.queryByPlaceholderText(/Optional opening paragraph/i),
    ).toBeNull();
    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0];
    const normalized =
      typeof updater === "function"
        ? updater({
            ...sampleState,
            intro: "Legacy intro paragraph that should merge into sections.",
          })
        : updater;
    expect(normalized.intro).toBeUndefined();
    expect(normalized.sections[0].body).toContain(
      "Legacy intro paragraph that should merge into sections.",
    );
  });

  test("shows introduction editor when first section is introduction", () => {
    render(
      <ArticleEditorLayout
        state={sampleState}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("article-section-body-editor").getAttribute(
      "data-section-kind",
    )).toBe("introduction");
    expect(screen.getByText(/Hook your readers/i)).toBeTruthy();
  });

  test("shows image menu trigger when onGenerateImage is provided", () => {
    render(
      <ArticleEditorLayout
        state={sampleState}
        onChange={vi.fn()}
        onGenerateImage={vi.fn()}
      />,
    );

    expect(screen.getByTestId("article-editor-image-menu-trigger")).toBeTruthy();
    expect(screen.queryByTestId("article-editor-image-actions")).toBeNull();
  });
});
