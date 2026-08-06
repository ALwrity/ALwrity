/**
 * ArticleEditorImageMenu tests.
 * Run manually:
 *   npx react-scripts test --watchAll=false --testPathPattern=ArticleEditorImageMenu
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleEditorImageMenu } from "../components/ArticleEditor/ArticleEditorImageMenu";

describe("ArticleEditorImageMenu", () => {
  test("opens popover with generate and upload actions", () => {
    const onUploadImage = jest.fn();
    const onGenerateImage = jest.fn();

    render(
      <ArticleEditorImageMenu
        onUploadImage={onUploadImage}
        onGenerateImage={onGenerateImage}
      />,
    );

    fireEvent.click(screen.getByTestId("article-editor-image-menu-trigger"));
    expect(screen.getByTestId("article-editor-image-menu")).toBeTruthy();
    expect(screen.getByText(/Generate with AI/i)).toBeTruthy();
    expect(screen.getByText(/Upload image/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/Upload image/i));
    expect(onUploadImage).toHaveBeenCalled();
  });
});
