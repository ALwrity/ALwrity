import React from "react";
import { Stack, Typography, Paper, Box, alpha } from "@mui/material";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Script, Job } from "../types";

interface RenderQueueStatusDashboardProps {
  script: Script;
  allVideosReady: boolean;
  allScenesCompleted: boolean;
}

export const RenderQueueStatusDashboard: React.FC<RenderQueueStatusDashboardProps> = ({
  script,
  allVideosReady,
  allScenesCompleted,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        p: 2,
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Status Chips */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {/* Scenes Count */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              background: alpha("#6366f1", 0.08),
              color: "#4f46e5",
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: "1px solid",
              borderColor: alpha("#6366f1", 0.2),
            }}
          >
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Scenes
            </Typography>
            <Typography variant="subtitle2" fontWeight={800}>
              {script.scenes.length}
            </Typography>
          </Box>

          {/* Audio Status */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              background: script.scenes.every(s => s.audioUrl) 
                ? alpha("#10b981", 0.1) 
                : alpha("#f59e0b", 0.1),
              color: script.scenes.every(s => s.audioUrl) ? "#059669" : "#d97706",
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: "1px solid",
              borderColor: script.scenes.every(s => s.audioUrl) ? alpha("#10b981", 0.3) : alpha("#f59e0b", 0.3),
            }}
          >
            <Typography variant="caption" fontWeight={700}>
              Audio
            </Typography>
            {script.scenes.every(s => s.audioUrl) ? (
              <CheckCircleIcon sx={{ fontSize: 18 }} />
            ) : (
              <Typography variant="subtitle2" fontWeight={800}>
                {script.scenes.filter(s => s.audioUrl).length}/{script.scenes.length}
              </Typography>
            )}
          </Box>

          {/* Images Status */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              background: script.scenes.every(s => s.imageUrl) 
                ? alpha("#10b981", 0.1) 
                : alpha("#f59e0b", 0.1),
              color: script.scenes.every(s => s.imageUrl) ? "#059669" : "#d97706",
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: "1px solid",
              borderColor: script.scenes.every(s => s.imageUrl) ? alpha("#10b981", 0.3) : alpha("#f59e0b", 0.3),
            }}
          >
            <Typography variant="caption" fontWeight={700}>
              Images
            </Typography>
            {script.scenes.every(s => s.imageUrl) ? (
              <CheckCircleIcon sx={{ fontSize: 18 }} />
            ) : (
              <Typography variant="subtitle2" fontWeight={800}>
                {script.scenes.filter(s => s.imageUrl).length}/{script.scenes.length}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Dynamic Guidance Message */}
        <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 1 }}>
          <Box component="span" sx={{ 
            width: 6, 
            height: 6, 
            borderRadius: "50%", 
            bgcolor: allVideosReady ? "#10b981" : "#3b82f6",
            display: "inline-block"
          }} />
          {allVideosReady 
            ? "All assets ready. You can combine videos below." 
            : !script.scenes.every(s => s.audioUrl)
            ? "Generate audio for all scenes to proceed."
            : !script.scenes.every(s => s.imageUrl)
            ? "Generate images for video backgrounds."
            : "Ready to generate scene videos."}
        </Typography>
      </Stack>
    </Paper>
  );
};