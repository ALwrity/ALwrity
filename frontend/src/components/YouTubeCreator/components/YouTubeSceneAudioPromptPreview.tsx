/**
 * Preview of the narration text that will be sent for YouTube scene voice.
 */

import React from "react";
import { Box, Typography } from "@mui/material";

interface YouTubeSceneAudioPromptPreviewProps {
  inputText: string;
  /** UI-only hints; never sent to WaveSpeed. */
  deliveryNotes?: string;
}

export const YouTubeSceneAudioPromptPreview: React.FC<YouTubeSceneAudioPromptPreviewProps> = ({
  inputText,
  deliveryNotes,
}) => {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
        Voice text that will be sent (scene narration only)
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
      {deliveryNotes ? (
        <Box sx={{ mt: 1.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
            Delivery notes (not spoken)
          </Typography>
          <Box
            component="pre"
            sx={{
              mt: 0.5,
              p: 1.25,
              bgcolor: "#fff7ed",
              borderRadius: 1,
              whiteSpace: "pre-wrap",
              fontSize: "0.8125rem",
              color: "#9a3412",
              fontFamily: "inherit",
              m: 0,
              maxHeight: 120,
              overflow: "auto",
            }}
          >
            {deliveryNotes}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};
