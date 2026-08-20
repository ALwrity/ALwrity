/**
 * Preview of the image prompt that will be sent for a YouTube scene.
 */

import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { buildYoutubeSceneImagePromptPreview } from "../utils/buildYoutubeSceneImagePromptPreview";

interface YouTubeSceneImagePromptPreviewProps {
  sceneTitle?: string;
  sceneContent?: string;
  idea?: string;
  customPrompt?: string;
  hasBaseAvatar?: boolean;
}

export const YouTubeSceneImagePromptPreview: React.FC<YouTubeSceneImagePromptPreviewProps> = ({
  sceneTitle,
  sceneContent,
  idea,
  customPrompt,
  hasBaseAvatar,
}) => {
  const preview = buildYoutubeSceneImagePromptPreview({
    sceneTitle,
    sceneContent,
    idea,
    customPrompt,
    hasBaseAvatar,
  });

  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Type: ${preview.generationType}`} />
        {preview.customPromptUsed ? <Chip size="small" label="Custom prompt" /> : null}
      </Stack>
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
          Image prompt that will be sent
        </Typography>
        <Box
          component="pre"
          sx={{
            mt: 0.5,
            p: 1.25,
            bgcolor: "#f8fafc",
            borderRadius: 1,
            whiteSpace: "pre-wrap",
            fontSize: "0.8125rem",
            color: "#374151",
            fontFamily: "inherit",
            m: 0,
            maxHeight: 180,
            overflow: "auto",
          }}
        >
          {preview.imagePrompt}
        </Box>
      </Box>
    </Stack>
  );
};
