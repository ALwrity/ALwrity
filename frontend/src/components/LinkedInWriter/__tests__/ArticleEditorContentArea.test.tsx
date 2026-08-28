/**
 * ArticleEditorContentArea tests.
 * Run manually:
 *   npx vitest run ArticleEditorContentArea
 */

import React, { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { ArticleEditorContentArea } from "../components/ArticleEditor/ArticleEditorContentArea";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";

vi.mock("../components/LinkedInArticleLivePreview", () => ({
  LinkedInArticleLivePreview: () => (
    <div data-testid="mock-article-live-preview">article preview</div>
  ),
}));

vi.mock("../components/LinkedInDraftPreview", () => ({
  LinkedInDraftPreview: ({ draft }: { draft: string }) => (
    <div data-testid="mock-citation-preview">{draft.slice(0, 40)}</div>
  ),
}));

vi.mock("../components/ArticleEditor/ArticleEditorLayout", () => ({
  ArticleEditorLayout: () => <div data-testid="article-editor-layout">editor</div>,
}));

vi.mock("../components/LinkedInAssistiveWritingCard", () => ({
  __esModule: true,
  default: () => <div data-testid="assistive-writing-card" />,
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
};

const baseProps = {
  contentRef: createRef<HTMLDivElement>(),
  articleDraftState: sampleState,
  onArticleDraftChange: vi.fn(),
  draftMarkdown: "# Future of Remote Work\n\nRemote work is here to stay.",
  isGenerating: false,
  loadingMessage: "",
  assistantOn: false,
};

describe("ArticleEditorContentArea", () => {
  test("studio mode with assistive off shows citation preview only", () => {
    render(
      <ArticleEditorContentArea
        {...baseProps}
        previewMode="studio"
      />,
    );

    expect(screen.getByTestId("article-citation-preview")).toBeTruthy();
    expect(screen.getByTestId("mock-citation-preview")).toBeTruthy();
    expect(screen.queryByTestId("article-editor-layout")).toBeNull();
    expect(screen.queryByTestId("article-linkedin-preview")).toBeNull();
  });

  test("linkedin mode with assistive off shows article live preview only", () => {
    render(
      <ArticleEditorContentArea
        {...baseProps}
        previewMode="linkedin"
      />,
    );

    expect(screen.getByTestId("article-linkedin-preview")).toBeTruthy();
    expect(screen.getByTestId("mock-article-live-preview")).toBeTruthy();
    expect(screen.queryByTestId("article-editor-layout")).toBeNull();
    expect(screen.queryByTestId("article-citation-preview")).toBeNull();
  });

  test("studio mode with assistive on shows editor without stacked citation preview", () => {
    render(
      <ArticleEditorContentArea
        {...baseProps}
        previewMode="studio"
        assistantOn
      />,
    );

    expect(screen.getByTestId("article-assistive-editor")).toBeTruthy();
    expect(screen.getByTestId("article-editor-layout")).toBeTruthy();
    expect(screen.queryByTestId("article-citation-preview")).toBeNull();
    expect(screen.queryByTestId("article-linkedin-preview")).toBeNull();
  });

  test("linkedin mode with assistive on shows editor and article preview below", () => {
    render(
      <ArticleEditorContentArea
        {...baseProps}
        previewMode="linkedin"
        assistantOn
      />,
    );

    expect(screen.getByTestId("article-assistive-editor")).toBeTruthy();
    expect(screen.getByTestId("article-editor-layout")).toBeTruthy();
    expect(screen.getByTestId("article-linkedin-preview")).toBeTruthy();
    expect(screen.queryByTestId("article-citation-preview")).toBeNull();
  });
});
