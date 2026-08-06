/**
 * LinkedIn article live preview — article card layout with desktop/mobile frames.
 */

import React, { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import type { LinkedInArticleDraftState } from "../utils/linkedInArticleDraftUtils";
import {
  buildArticleLivePreviewFromMarkdown,
  buildArticleLivePreviewModel,
} from "../utils/articleLivePreviewUtils";
import type { LinkedInFeedDevice } from "../utils/linkedInFeedPreviewUtils";
import { LinkedInFeedPreviewFrame } from "./LinkedInFeedPreviewFrame";
import { LinkedInAuthenticatedImage } from "./LinkedInAuthenticatedImage";

const LOG_PREFIX = "[LinkedInArticleLivePreview]";

export interface LinkedInArticleLivePreviewProps {
  state: LinkedInArticleDraftState;
  draftMarkdown?: string;
  authorName?: string;
  authorHeadline?: string;
}

export const LinkedInArticleLivePreview: React.FC<
  LinkedInArticleLivePreviewProps
> = ({
  state,
  draftMarkdown = "",
  authorName = "Your Name",
  authorHeadline = "Your headline",
}) => {
  const [device, setDevice] = useState<LinkedInFeedDevice>("desktop");

  const model = useMemo(() => {
    try {
      if (state?.title) {
        return buildArticleLivePreviewModel(state);
      }
      return buildArticleLivePreviewFromMarkdown(draftMarkdown);
    } catch (error) {
      console.error(`${LOG_PREFIX} failed to build preview model`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return buildArticleLivePreviewFromMarkdown(draftMarkdown);
    }
  }, [state, draftMarkdown]);

  return (
    <Box data-testid="linkedin-article-live-preview">
      <LinkedInFeedPreviewFrame
        device={device}
        onDeviceChange={setDevice}
        caption="Article preview — how your article card appears in the LinkedIn feed"
      >
        <Box
          sx={{
            bgcolor: "#fff",
            borderRadius: 1.5,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <Box sx={{ display: "flex", gap: 1.25, p: 1.5, alignItems: "center" }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                bgcolor: "#0a66c2",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {authorName.trim()[0]?.toUpperCase() || "Y"}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                {authorName}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#64748b" }}>
                {authorHeadline}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#94a3b8", mt: 0.25 }}>
                Shared an article · Just now
              </Typography>
            </Box>
          </Box>

          {model.heroImage ? (
            <Box sx={{ bgcolor: "#f1f5f9" }}>
              {model.heroImage.imageId ? (
                <LinkedInAuthenticatedImage
                  imageId={model.heroImage.imageId}
                  alt={model.heroImage.alt}
                />
              ) : (
                <Box
                  component="img"
                  src={model.heroImage.url}
                  alt={model.heroImage.alt}
                  sx={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                />
              )}
            </Box>
          ) : null}

          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
              <ArticleOutlinedIcon sx={{ fontSize: 18, color: "#0a66c2" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#0a66c2" }}>
                LinkedIn Article
              </Typography>
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: device === "mobile" ? 18 : 20,
                color: "#1e293b",
                lineHeight: 1.3,
                mb: 0.75,
              }}
            >
              {model.title}
            </Typography>
            <Typography sx={{ fontSize: 14, color: "#475569", lineHeight: 1.5, mb: 1 }}>
              {model.excerpt}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>
              {model.readingTime
                ? `${model.readingTime} min read`
                : `${model.sectionCount} section${model.sectionCount === 1 ? "" : "s"}`}
            </Typography>
          </Box>
        </Box>
      </LinkedInFeedPreviewFrame>
    </Box>
  );
};
