/**
 * Preview of the narration text that will be sent for YouTube scene voice.
 */

import React from "react";
import { Box, Typography } from "@mui/material";

interface YouTubeSceneAudioPromptPreviewProps {
  inputText: string;
}

export const YouTubeSceneAudioPromptPreview: React.FC<YouTubeSceneAudioPromptPreviewProps> = ({
  inputText,
}) => {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
        Voice text that will be sent (server may strip [Pacing: …] markers)
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
        {inputText || "(empty)"}
      </Box>
    </Box>
  );
};
