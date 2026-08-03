/**
 * LinkedIn feed post body with inline "…see more" truncation.
 */
import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { LinkedInFeedDevice } from "../utils/linkedInFeedPreviewUtils";
import { getFeedCollapsedText } from "../utils/linkedInFeedPreviewUtils";

interface LinkedInFeedPostBodyProps {
  plainText: string;
  device: LinkedInFeedDevice;
  compact?: boolean;
}

export const LinkedInFeedPostBody: React.FC<LinkedInFeedPostBodyProps> = ({
  plainText,
  device,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const folded = getFeedCollapsedText(plainText, device, false);
  const { collapsedText, isTruncated } = getFeedCollapsedText(
    plainText,
    device,
    expanded,
  );

  useEffect(() => {
    setExpanded(false);
  }, [device, plainText]);

  if (!plainText.trim()) {
    return (
      <Typography
        variant="body2"
        sx={{ color: "#666", fontStyle: "italic", fontSize: compact ? 13 : 14 }}
      >
        Nothing to preview yet. Add post text first.
      </Typography>
    );
  }

  const fontSize = compact ? 13 : 14;
  const bodySx = {
    m: 0,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize,
    lineHeight: 1.45,
    color: "rgba(0,0,0,0.9)",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  };

  if (expanded) {
    return (
      <Box>
        <Typography component="div" sx={bodySx}>
          {plainText.trim()}
        </Typography>
        {folded.isTruncated && (
          <Box
            component="button"
            type="button"
            onClick={() => setExpanded(false)}
            sx={{
              mt: 0.5,
              border: "none",
              p: 0,
              bgcolor: "transparent",
              color: "rgba(0,0,0,0.6)",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              "&:hover": { color: "#0a66c2" },
            }}
          >
            see less
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Typography component="div" sx={bodySx}>
      {collapsedText}
      {isTruncated && (
        <>
          {"… "}
          <Box
            component="button"
            type="button"
            onClick={() => setExpanded(true)}
            sx={{
              border: "none",
              p: 0,
              m: 0,
              bgcolor: "transparent",
              color: "rgba(0,0,0,0.6)",
              fontWeight: 600,
              fontSize: "inherit",
              fontFamily: "inherit",
              cursor: "pointer",
              display: "inline",
              "&:hover": { color: "#0a66c2", textDecoration: "underline" },
            }}
          >
            see more
          </Box>
        </>
      )}
    </Typography>
  );
};
