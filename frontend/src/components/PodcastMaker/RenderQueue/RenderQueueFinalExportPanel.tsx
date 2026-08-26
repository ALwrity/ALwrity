import React from "react";
import { Stack, Typography, Paper, Box, Button, CircularProgress, LinearProgress, Alert, alpha } from "@mui/material";
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Script } from "../types";

interface RenderQueueFinalExportPanelProps {
  script: Script;
  allVideosReady: boolean;
  finalVideoUrl: string | null;
  finalVideoBlobUrl: string | null;
  combiningVideos: boolean;
  combiningProgress: { progress: number; message: string } | null;
  onCombineFinalVideo: () => void;
}

export const RenderQueueFinalExportPanel: React.FC<RenderQueueFinalExportPanelProps> = ({
  script,
  allVideosReady,
  finalVideoUrl,
  finalVideoBlobUrl,
  combiningVideos,
  combiningProgress,
  onCombineFinalVideo,
}) => {
  if (!allVideosReady) return null;

  return (
    <Paper
      elevation={3}
      sx={{
        mt: 4,
        p: 4,
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)",
        border: "2px solid",
        borderColor: finalVideoUrl ? "success.main" : "info.light",
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: finalVideoUrl 
            ? "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)"
            : "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
        },
      }}
    >
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: finalVideoUrl 
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            }}
          >
            {finalVideoUrl ? (
              <CheckCircleIcon sx={{ color: "white", fontSize: 32 }} />
            ) : (
              <VideoLibraryIcon sx={{ color: "white", fontSize: 32 }} />
            )}
          </Box>
          <Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                color: "#0f172a",
                mb: 0.5,
              }}
            >
              {finalVideoUrl ? "Final Podcast Ready!" : "Final Podcast Export"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              {finalVideoUrl 
                ? "Your complete podcast video is ready to download"
                : `Combine ${script.scenes.length} scene videos into one final podcast`}
            </Typography>
          </Box>
        </Stack>

        {finalVideoUrl ? (
          <Stack spacing={3}>
            <Alert 
              severity="success"
              icon={<CheckCircleIcon />}
              sx={{ 
                background: alpha("#10b981", 0.1),
                border: "1px solid",
                borderColor: alpha("#10b981", 0.3),
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Your final podcast video has been created successfully!
              </Typography>
            </Alert>
            
            {/* Video Preview */}
            <Box
              sx={{
                width: "100%",
                maxWidth: 900,
                mx: "auto",
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                border: "1px solid",
                borderColor: alpha("#10b981", 0.2),
              }}
            >
              <video
                controls
                src={finalVideoBlobUrl || finalVideoUrl}
                style={{
                  width: "100%",
                  display: "block",
                  backgroundColor: "#000",
                }}
              >
                Your browser does not support video playback.
              </video>
            </Box>

            {/* Download Button */}
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ pt: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  if (finalVideoBlobUrl) {
                    const link = document.createElement("a");
                    link.href = finalVideoBlobUrl;
                    link.download = `podcast-final-${Date.now()}.mp4`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                sx={{
                  px: 4,
                  py: 1.5,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    boxShadow: "0 6px 16px rgba(16, 185, 129, 0.5)",
                  },
                }}
              >
                Download Final Podcast
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={3}>
            <Alert 
              severity="info"
              sx={{ 
                background: alpha("#3b82f6", 0.08),
                border: "1px solid",
                borderColor: alpha("#3b82f6", 0.2),
              }}
            >
              <Typography variant="body2">
                <strong>Ready to export!</strong> Click below to combine all {script.scenes.length} scene videos into your final podcast video.
              </Typography>
            </Alert>

            {combiningVideos && (
              <Box sx={{ width: "100%" }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "#0f172a" }}>
                    {combiningProgress?.message || "Combining videos..."}
                  </Typography>
                  {combiningProgress && (
                    <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 600 }}>
                      {combiningProgress.progress.toFixed(0)}%
                    </Typography>
                  )}
                </Stack>
                <LinearProgress 
                  variant={combiningProgress ? "determinate" : "indeterminate"}
                  value={combiningProgress?.progress || 0}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    background: alpha("#667eea", 0.1),
                    "& .MuiLinearProgress-bar": {
                      background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: 4,
                    },
                  }}
                />
                {combiningProgress && combiningProgress.progress < 100 && (
                  <Typography variant="caption" sx={{ color: "#64748b", mt: 0.5, display: "block" }}>
                    Video encoding in progress. This may take a few minutes...
                  </Typography>
                )}
              </Box>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={combiningVideos ? <CircularProgress size={20} sx={{ color: "white" }} /> : <VideoLibraryIcon />}
              onClick={onCombineFinalVideo}
              disabled={combiningVideos}
              sx={{
                py: 2,
                fontSize: "1.1rem",
                fontWeight: 700,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)",
                  boxShadow: "0 6px 16px rgba(102, 126, 234, 0.5)",
                },
                "&:disabled": {
                  background: alpha("#667eea", 0.5),
                },
              }}
            >
              {combiningVideos ? "Combining Videos..." : "Combine Scenes into Final Video"}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};