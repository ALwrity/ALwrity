/**
 * LinkedInEditorShell routing smoke tests.
 * Run manually:
 *   npx vitest run LinkedInEditorShell
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LinkedInEditorShell } from "../components/editorShell/LinkedInEditorShell";

vi.mock("../components/PublishLinkedInPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="publish-linkedin-panel">Publish</div>,
}));

const baseProps = {
  draft: "Sample draft content for testing.",
  onBackToDashboard: vi.fn(),
  saveStatus: "idle" as const,
  onSave: vi.fn(),
  onOpenQualityCheck: vi.fn(),
  previewMode: "studio" as const,
  onPreviewModeChange: vi.fn(),
};

describe("LinkedInEditorShell", () => {
  test("renders post shell with preview toggle and publish panel", () => {
    render(
      <LinkedInEditorShell {...baseProps} draftContentType="post" />,
    );

    expect(screen.getByTestId("post-editor-shell")).toBeTruthy();
    expect(screen.getByTestId("post-preview-mode-toggle")).toBeTruthy();
    expect(screen.getByTestId("publish-linkedin-panel")).toBeTruthy();
    expect(screen.getByTestId("engagement-booster-toolbar-btn")).toBeTruthy();
    expect(screen.queryByTestId("article-editor-shell")).toBeNull();
  });

  test("renders article shell with preview toggle and gated publish panel", () => {
    render(
      <LinkedInEditorShell {...baseProps} draftContentType="article" />,
    );

    expect(screen.getByTestId("article-editor-shell")).toBeTruthy();
    expect(screen.getByTestId("article-preview-mode-toggle")).toBeTruthy();
    expect(screen.queryByTestId("post-preview-mode-toggle")).toBeNull();
    expect(screen.getByTestId("publish-linkedin-panel")).toBeTruthy();
    expect(screen.getByTestId("engagement-booster-toolbar-btn")).toBeTruthy();
    expect(screen.queryByTestId("article-editor-placeholder")).toBeNull();
  });

  test("defaults to post shell for carousel content type", () => {
    render(
      <LinkedInEditorShell {...baseProps} draftContentType="carousel" />,
    );

    expect(screen.getByTestId("post-editor-shell")).toBeTruthy();
    expect(screen.getByTestId("publish-linkedin-panel")).toBeTruthy();
  });
});
