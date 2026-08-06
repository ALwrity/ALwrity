/**
 * Formatting toolbar for the structured article editor (matches post toolbar).
 */

import React from "react";
import { LinkedInEditorToolbar } from "../LinkedInEditorToolbar";
import type { MarkdownFormatType } from "../../../TextEditor/markdownFormatting";
import { ArticleEditorImageMenu } from "./ArticleEditorImageMenu";

export interface ArticleEditorToolbarProps {
  onFormat: (type: MarkdownFormatType) => void;
  onUploadImage?: () => void;
  onGenerateImage?: () => void;
  onInsertEmoji?: (emoji: string) => void;
  disabled?: boolean;
  isUploading?: boolean;
  hasImages?: boolean;
  sectionHeading?: string;
}

export const ArticleEditorToolbar: React.FC<ArticleEditorToolbarProps> = ({
  onFormat,
  onUploadImage,
  onGenerateImage,
  onInsertEmoji,
  disabled = false,
  isUploading = false,
  hasImages = false,
  sectionHeading,
}) => (
  <div data-testid="article-editor-toolbar">
    <LinkedInEditorToolbar
      onFormat={onFormat}
      onUploadImage={onUploadImage ?? (() => undefined)}
      onInsertEmoji={onInsertEmoji}
      disabled={disabled}
      isUploading={isUploading}
      renderImageAction={() => (
        <ArticleEditorImageMenu
          onUploadImage={onUploadImage ?? (() => undefined)}
          onGenerateImage={onGenerateImage}
          isUploading={isUploading}
          disabled={disabled}
          hasImages={hasImages}
        />
      )}
    />
    <p
      style={{
        margin: 0,
        padding: "0 12px 8px",
        fontSize: 11,
        lineHeight: 1.4,
        color: "#64748b",
        background: "#f8fafc",
        borderLeft: "1px solid #e2e8f0",
        borderRight: "1px solid #e2e8f0",
      }}
    >
      {sectionHeading
        ? `Formatting “${sectionHeading}” — bold, lists, and links supported`
        : "Select a section below, then format its text"}
    </p>
  </div>
);
