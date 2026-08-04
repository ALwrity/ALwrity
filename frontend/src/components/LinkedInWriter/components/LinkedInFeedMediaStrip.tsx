/**
 * Media strip for LinkedIn feed preview — images from draft markdown.
 */
import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { splitDraftByImageMarkdown } from "../utils/linkedInImageDraftUtils";
import { LinkedInAuthenticatedImage } from "./LinkedInAuthenticatedImage";
import type { LinkedInFeedDevice } from "../utils/linkedInFeedPreviewUtils";

interface LinkedInFeedMediaStripProps {
  draft: string;
  device: LinkedInFeedDevice;
}

export const LinkedInFeedMediaStrip: React.FC<LinkedInFeedMediaStripProps> = ({
  draft,
  device,
}) => {
  const images = useMemo(
    () =>
      splitDraftByImageMarkdown(draft).filter(
        (segment) => segment.type === "image",
      ),
    [draft],
  );

  if (images.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 1.25,
        mx: device === "mobile" ? -1.25 : 0,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      {images.map((segment, index) => {
        if (segment.type !== "image") return null;
        return (
          <Box
            key={`feed-media-${segment.imageId || segment.url}-${index}`}
            sx={{
              borderRadius: device === "mobile" ? 0 : 1,
              overflow: "hidden",
              border: device === "mobile" ? "none" : "1px solid #e0e0e0",
              bgcolor: "#f8fafc",
              "& img": {
                width: "100%",
                maxHeight: device === "mobile" ? 280 : 320,
                objectFit: "cover",
                display: "block",
                margin: "0 !important",
                borderRadius: 0,
              },
            }}
          >
            {segment.imageId ? (
              <LinkedInAuthenticatedImage
                imageId={segment.imageId}
                alt={segment.alt}
              />
            ) : (
              <Box
                component="img"
                src={segment.url}
                alt={segment.alt}
                sx={{ width: "100%", display: "block" }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};
