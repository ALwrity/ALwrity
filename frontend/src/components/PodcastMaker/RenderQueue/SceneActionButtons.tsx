import React from "react";
import { Stack, alpha, Tooltip, IconButton } from "@mui/material";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { Scene, Job } from "../types";
import { PrimaryButton, SecondaryButton } from "../ui";
import { Typography } from "@mui/material";
import { OperationButton } from "../../shared/OperationButton";

interface SceneActionButtonsProps {
  scene: Scene;
  job?: Job;
  hasAudio: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  audioUrl: string;
  rendering: string | null;
  generatingImage: string | null;
  isBusy: boolean;
  totalScenes?: number;
  onRender: (sceneId: string, mode: "preview" | "full") => void;
  onImageGenerate: (sceneId: string) => void;
  onVideoRender: (sceneId: string) => void;
  onDownloadAudio: (audioUrl: string, title: string) => void;
  onDownloadVideo: (videoUrl: string, title: string) => void;
  onShare: (audioUrl: string, title: string) => void;
  onDelete: (sceneId: string) => void;
  onError: (message: string) => void;
}

export const SceneActionButtons: React.FC<SceneActionButtonsProps> = ({
  scene,
  job,
  hasAudio,
  hasImage,
  hasVideo,
  audioUrl,
  rendering,
  generatingImage,
  isBusy,
  totalScenes,
  onRender,
  onImageGenerate,
  onVideoRender,
  onDownloadAudio,
  onDownloadVideo,
  onShare,
  onDelete,
  onError,
}) => {
  const isGeneratingImage = generatingImage === scene.id;
  const needsAudio = !hasAudio && (!job || job.status === "idle");

  // No audio - show generate buttons
  if (needsAudio) {
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Tooltip title={totalScenes && totalScenes <= 1 ? "Cannot delete the last scene" : "Delete this scene"}>
          <IconButton
            onClick={() => onDelete(scene.id)}
            disabled={isBusy || (totalScenes !== undefined && totalScenes <= 1)}
            sx={{
              color: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 2,
              padding: 1.5,
              "&:hover": {
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.3)",
              },
              "&:disabled": {
                backgroundColor: "rgba(156, 163, 175, 0.1)",
                borderColor: "rgba(156, 163, 175, 0.2)",
                color: "#9ca3af",
              },
            }}
          >
            <DeleteIcon sx={{ fontSize: "1.25rem" }} />
          </IconButton>
        </Tooltip>
        <SecondaryButton
          onClick={() => onRender(scene.id, "preview")}
          disabled={isBusy}
          startIcon={<VolumeUpIcon />}
          tooltip="Preview a sample to test voice and pacing"
        >
          Preview Sample
        </SecondaryButton>
        <OperationButton
          operation={{
            provider: "audio",
            model: "minimax/speech-02-hd",
            tokens_requested: scene.lines.reduce((sum, l) => sum + l.text.length, 0),
            operation_type: "tts_full_render",
            actual_provider_name: "wavespeed",
          }}
          label="Generate Audio"
          variant="contained"
          size="medium"
          startIcon={<PlayArrowIcon />}
          showCost={true}
          checkOnHover={true}
          checkOnMount={false}
          onClick={() => onRender(scene.id, "full")}
          disabled={isBusy}
          sx={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
            },
            "&:disabled": {
              background: alpha("#9ca3af", 0.3),
              color: alpha("#fff", 0.5),
            },
          }}
        />
      </Stack>
    );
  }

  // Video generation failed - show specific retry for video
  if (job?.status === "failed" && !needsAudio && hasAudio) {
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Tooltip title={totalScenes && totalScenes <= 1 ? "Cannot delete the last scene" : "Delete this scene"}>
          <IconButton
            onClick={() => onDelete(scene.id)}
            disabled={isBusy || (totalScenes !== undefined && totalScenes <= 1)}
            sx={{
              color: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 2,
              padding: 1.5,
              "&:hover": {
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.3)",
              },
              "&:disabled": {
                backgroundColor: "rgba(156, 163, 175, 0.1)",
                borderColor: "rgba(156, 163, 175, 0.2)",
                color: "#9ca3af",
              },
            }}
          >
            <DeleteIcon sx={{ fontSize: "1.25rem" }} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="error" sx={{ alignSelf: "center", mr: 1 }}>
          Video Generation Failed
        </Typography>
        <SecondaryButton
          onClick={() => onVideoRender(scene.id)}
          startIcon={<RefreshIcon />}
          tooltip="Retry video generation"
          sx={{ borderColor: "error.main", color: "error.main" }}
        >
          Retry Video
        </SecondaryButton>
      </Stack>
    );
  }

  // Failed (Audio) - show retry
  if (job?.status === "failed") {
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Tooltip title={totalScenes && totalScenes <= 1 ? "Cannot delete the last scene" : "Delete this scene"}>
          <IconButton
            onClick={() => onDelete(scene.id)}
            disabled={isBusy || (totalScenes !== undefined && totalScenes <= 1)}
            sx={{
              color: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 2,
              padding: 1.5,
              "&:hover": {
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.3)",
              },
              "&:disabled": {
                backgroundColor: "rgba(156, 163, 175, 0.1)",
                borderColor: "rgba(156, 163, 175, 0.2)",
                color: "#9ca3af",
              },
            }}
          >
            <DeleteIcon sx={{ fontSize: "1.25rem" }} />
          </IconButton>
        </Tooltip>
        <SecondaryButton
          onClick={() => onRender(scene.id, "full")}
          startIcon={<RefreshIcon />}
          tooltip="Retry audio generation"
        >
          Retry Audio
        </SecondaryButton>
      </Stack>
    );
  }

  // Has audio - show all action buttons
  const videoInProgress = rendering !== null;
  const isCurrentVideo = rendering === scene.id;

  return (
    <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {/* Delete Scene Button */}
      <Tooltip title={totalScenes && totalScenes <= 1 ? "Cannot delete the last scene" : "Delete this scene"}>
        <IconButton
          onClick={() => onDelete(scene.id)}
          disabled={isBusy || (totalScenes !== undefined && totalScenes <= 1)}
          sx={{
            color: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 2,
            padding: 1.5,
            "&:hover": {
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            },
            "&:disabled": {
              backgroundColor: "rgba(156, 163, 175, 0.1)",
              borderColor: "rgba(156, 163, 175, 0.2)",
              color: "#9ca3af",
            },
          }}
        >
          <DeleteIcon sx={{ fontSize: "1.25rem" }} />
        </IconButton>
      </Tooltip>
      
      {/* Generate/Regenerate Image - ALWAYS visible if we have audio */}
      <OperationButton
        operation={{
          provider: "stability",
          operation_type: "image_generation",
          actual_provider_name: "wavespeed",
        }}
        label={isGeneratingImage ? "Generating..." : hasImage ? "Regenerate Image" : "Generate Image"}
        variant="contained"
        size="medium"
        startIcon={<ImageIcon />}
        showCost={true}
        checkOnHover={true}
        checkOnMount={false}
        onClick={() => onImageGenerate(scene.id)}
        disabled={isGeneratingImage}
        loading={isGeneratingImage}
        sx={{
          minWidth: 160,
          background: hasImage ? alpha("#667eea", 0.1) : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: hasImage ? "#667eea" : "white",
          border: hasImage ? "1px solid rgba(102,126,234,0.3)" : undefined,
          fontWeight: 600,
          textTransform: "none",
          "&:hover": {
            background: hasImage ? alpha("#667eea", 0.2) : "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
          },
          "&:disabled": {
            background: alpha("#9ca3af", 0.3),
            color: alpha("#fff", 0.5),
          },
        }}
      />

      {/* Generate Video - ALWAYS visible if we have audio */}
      <OperationButton
        operation={{
          provider: "video",
          model: "kling-v2.5-turbo-5s",
          operation_type: "video_generation",
          actual_provider_name: "wavespeed",
        }}
        label={
          videoInProgress && isCurrentVideo
            ? "Generating Video..."
            : hasVideo
            ? "Regenerate Video"
            : "Generate Video"
        }
        variant="contained"
        size="medium"
        startIcon={<VideocamIcon />}
        showCost={true}
        checkOnHover={true}
        checkOnMount={false}
        onClick={() => onVideoRender(scene.id)}
        disabled={isBusy || videoInProgress || !hasImage}
        sx={{
          minWidth: 180,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontWeight: 600,
          textTransform: "none",
          "&:hover": {
            background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
          },
          "&:disabled": {
            background: alpha("#9ca3af", 0.3),
            color: alpha("#fff", 0.5),
          },
        }}
      />

      {/* Download Video */}
      {hasVideo && job?.videoUrl && (
        <SecondaryButton
          onClick={() => onDownloadVideo(job.videoUrl!, scene.title)}
          startIcon={<VideocamIcon />}
          tooltip="Download video file"
        >
          Download Video
        </SecondaryButton>
      )}

      {/* Download Audio */}
      {hasAudio && audioUrl && (
        <PrimaryButton
          onClick={() => onDownloadAudio(audioUrl, scene.title)}
          startIcon={<DownloadIcon />}
          tooltip="Download audio file"
          sx={{
            minWidth: 40,
            width: 40,
            padding: 0,
            background: alpha("#64748b", 0.1),
            color: "#64748b",
            border: "1px solid rgba(100, 116, 139, 0.2)",
            "&:hover": {
              background: alpha("#64748b", 0.2),
            },
          }}
        >
          {null}
        </PrimaryButton>
      )}

      {/* Share */}
      {hasAudio && audioUrl && (
        <PrimaryButton
          onClick={() => onShare(audioUrl, scene.title)}
          startIcon={<ShareIcon />}
          tooltip="Share audio link"
          sx={{
            minWidth: 40,
            width: 40,
            padding: 0,
            background: alpha("#64748b", 0.1),
            color: "#64748b",
            border: "1px solid rgba(100, 116, 139, 0.2)",
            "&:hover": {
              background: alpha("#64748b", 0.2),
            },
          }}
        >
          {null}
        </PrimaryButton>
      )}
    </Stack>
  );
};

