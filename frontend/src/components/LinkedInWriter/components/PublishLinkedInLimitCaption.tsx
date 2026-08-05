/**
 * Content-type-aware limit caption for LinkedIn publish toolbar/preview.
 * Posts show character count; articles show word count against generation target.
 */

import React from "react";
import { Tooltip, Typography } from "@mui/material";
import { LINKEDIN_POST_HARD_LIMIT } from "../utils/linkedInPostFormatConstants";
import {
  formatCharCountLabel,
  formatWordCountLabel,
  getArticleWordCaption,
  getCharReadiness,
  getSeeMoreCaption,
  getWordReadiness,
  resolveArticleWordTarget,
} from "../utils/linkedInPublishReadiness";
import { normalizeDraftContentType } from "../utils/linkedInDraftContentTypeStorage";
import type { LinkedInDraftContentType } from "../utils/linkedInDraftLibraryUtils";
import { readPrefs } from "../utils/linkedInWriterUtils";

export interface PublishLinkedInLimitCaptionProps {
  plainText: string;
  contentType?: LinkedInDraftContentType | null;
  targetWordCount?: number;
  /** Show inline see-more / soft-band suffix after the label. */
  showSuffix?: boolean;
}

export const PublishLinkedInLimitCaption: React.FC<
  PublishLinkedInLimitCaptionProps
> = ({ plainText, contentType, targetWordCount, showSuffix = true }) => {
  const isArticle = normalizeDraftContentType(contentType) === "article";

  if (isArticle) {
    const target =
      targetWordCount ??
      resolveArticleWordTarget(readPrefs() as Record<string, unknown>);
    const words = getWordReadiness(plainText, target);
    const softCaption = getArticleWordCaption(words);
    const label = formatWordCountLabel(words.count, words.target);
    const tooltip =
      softCaption ??
      `${words.count.toLocaleString()} words toward your ${words.target.toLocaleString()}-word target.`;

    return (
      <Tooltip title={tooltip} arrow placement="top">
        <Typography
          variant="caption"
          sx={{
            color: words.isEmpty ? "#64748b" : "#64748b",
            display: "block",
            whiteSpace: "nowrap",
            cursor: "help",
          }}
        >
          {label}
          {showSuffix && softCaption ? " · tip" : ""}
        </Typography>
      </Tooltip>
    );
  }

  const chars = getCharReadiness(plainText);
  const seeMoreCaption = getSeeMoreCaption(chars);

  return (
    <Tooltip
      title={
        seeMoreCaption
          ? 'Posts over ~1,300 characters show a "see more" cut-off on LinkedIn. Your hook and first 2 lines should capture attention before the fold.'
          : `${chars.count.toLocaleString()} / ${LINKEDIN_POST_HARD_LIMIT.toLocaleString()} LinkedIn character limit`
      }
      arrow
      placement="top"
    >
      <Typography
        variant="caption"
        sx={{
          color: chars.hardOk ? "#64748b" : "#dc2626",
          display: "block",
          whiteSpace: "nowrap",
          cursor: "help",
        }}
      >
        {formatCharCountLabel(chars.count)}
        {showSuffix && seeMoreCaption ? " · see more" : ""}
      </Typography>
    </Tooltip>
  );
};

/** Header badge text for preview panels (no tooltip wrapper). */
export function resolvePublishLimitHeaderLabel(
  plainText: string,
  contentType?: LinkedInDraftContentType | null,
  targetWordCount?: number,
): { label: string; warn: boolean } {
  const isArticle = normalizeDraftContentType(contentType) === "article";

  if (isArticle) {
    const target =
      targetWordCount ??
      resolveArticleWordTarget(readPrefs() as Record<string, unknown>);
    const words = getWordReadiness(plainText, target);
    return {
      label: formatWordCountLabel(words.count, words.target),
      warn: !words.isEmpty && (!words.softMinOk || !words.softMaxOk),
    };
  }

  const chars = getCharReadiness(plainText);
  return {
    label: formatCharCountLabel(chars.count),
    warn: !chars.hardOk,
  };
}
