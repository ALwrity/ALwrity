/**
 * LinkedIn article cover hero — image suggestion or placeholder.
 */

import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { ImageSuggestion } from "../../../../services/linkedInWriterApi";

export interface ArticleCoverBlockProps {
  coverImageUrl?: string;
  imageSuggestions?: ImageSuggestion[];
  onAddCover?: () => void;
}

export const ArticleCoverBlock: React.FC<ArticleCoverBlockProps> = ({
  coverImageUrl,
  imageSuggestions = [],
  onAddCover,
}) => {
  const suggestion = imageSuggestions[0];

  return (
    <Box
      data-testid="article-cover-block"
      sx={{
        width: "100%",
        aspectRatio: "16 / 9",
        maxHeight: 320,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        bgcolor: "#f1f5f9",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {coverImageUrl ? (
        <Box
          component="img"
          src={coverImageUrl}
          alt="Article cover"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Box sx={{ textAlign: "center", px: 2 }}>
          <ImageOutlinedIcon sx={{ fontSize: 40, color: "#94a3b8", mb: 1 }} />
          <Typography variant="body2" sx={{ color: "#64748b", mb: 0.5 }}>
            {suggestion?.description || "Add a cover image for your article"}
          </Typography>
          {suggestion?.alt_text ? (
            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
              Suggested: {suggestion.alt_text}
            </Typography>
          ) : null}
          {onAddCover ? (
            <Button
              size="small"
              variant="outlined"
              onClick={onAddCover}
              sx={{ mt: 1.5, textTransform: "none" }}
            >
              Generate cover
            </Button>
          ) : null}
        </Box>
      )}
    </Box>
  );
};
