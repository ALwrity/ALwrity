import React, { useEffect, useState, useCallback } from "react";
import { Box, Stack, Typography, Alert, Paper, LinearProgress, CircularProgress, alpha, IconButton, Divider, Chip, Tooltip } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Script, Knobs, Scene } from "../types";
import { BlogResearchResponse } from "../../../services/blogWriterApi";
import { podcastApi } from "../../../services/podcastApi";
import { aiApiClient } from "../../../api/client";
import { GlassyCard, PrimaryButton, SecondaryButton } from "../ui";
import { SceneEditor } from "./SceneEditor";
import { InlineAudioPlayer } from "../InlineAudioPlayer";
import { BrollInfoPanel } from "./parts/BrollInfoPanel";
import { ScriptEditorProvider } from "./ScriptEditorContext";

interface ScriptEditorProps {
  projectId: string;
  idea: string;
  research: any; // Research type
  rawResearch: BlogResearchResponse | null;
  knobs: Knobs;
  speakers: number;
  durationMinutes: number;
  script: Script | null;
  onScriptChange: (script: Script) => void;
  onBackToResearch: () => void;
  onProceedToRendering: (script: Script) => void;
  onError: (message: string) => void;
  avatarUrl?: string | null; // Base avatar URL for consistent scene image generation
  analysis?: any;
  outline?: any;
  podcastMode?: "audio_only" | "video_only" | "audio_video";
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  projectId,
  idea,
  research,
  rawResearch,
  knobs,
  speakers,
  durationMinutes,
  script: initialScript,
  onScriptChange,
  onBackToResearch,
  onProceedToRendering,
  onError,
  avatarUrl,
  analysis,
  outline,
  podcastMode = "video_only",
}) => {
  const [script, setScript] = useState<Script | null>(initialScript);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingSceneId, setApprovingSceneId] = useState<string | null>(null);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [combiningAudio, setCombiningAudio] = useState(false);
  const [combinedAudioResult, setCombinedAudioResult] = useState<{
    url: string;
    filename: string;
    duration: number;
    sceneCount: number;
  } | null>(null);

  // Defer upward script updates to avoid setState during render warnings
  const emitScriptChange = useCallback(
    (next: Script) => Promise.resolve().then(() => onScriptChange(next)),
    [onScriptChange]
  );

  // Sync with parent state
  useEffect(() => {
    if (initialScript) {
      setScript(initialScript);
    }
  }, [initialScript]);

  // Note: Script generation is now handled by ScriptEditorProvider
  // to ensure BrollInfoPanel and other child components have access to context

  const updateScene = (updated: Scene) => {
    // Use functional update to ensure we're working with latest state
    setScript((currentScript) => {
      if (!currentScript) return currentScript;
      const updatedScript = { 
        ...currentScript, 
        scenes: currentScript.scenes.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)) 
      };
      emitScriptChange(updatedScript);
      return updatedScript;
    });
  };

  const approveScene = async (sceneId: string) => {
    try {
      setApprovingSceneId(sceneId);
      await podcastApi.approveScene({ projectId, sceneId });
      // Use functional update to ensure we're working with latest state
      setScript((currentScript) => {
        if (!currentScript) return currentScript;
        const updatedScript = {
          ...currentScript,
          scenes: currentScript.scenes.map((s) => (s.id === sceneId ? { ...s, approved: true } : s)),
        };
        emitScriptChange(updatedScript);
        return updatedScript;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve scene";
      setError(message);
      onError(message);
      throw err;
    } finally {
      setApprovingSceneId((current) => (current === sceneId ? null : current));
    }
  };

  const deleteScene = useCallback((sceneId: string) => {
    if (!script) return;

    // Prevent deleting if it's the last scene
    if (script.scenes.length <= 1) {
      onError("Cannot delete the last scene. At least one scene is required.");
      return;
    }

    // Add confirmation dialog
    const sceneToDelete = script.scenes.find(s => s.id === sceneId);
    if (!sceneToDelete) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${sceneToDelete.title}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    // Remove the scene from the script
    const updatedScenes = script.scenes.filter(s => s.id !== sceneId);
    const updatedScript = { ...script, scenes: updatedScenes };
    
    emitScriptChange(updatedScript);
    setScript(updatedScript);
    
    // Show success message
    console.log(`[ScriptEditor] Scene "${sceneToDelete.title}" deleted successfully`);
  }, [script, emitScriptChange, onError]);

  const allApproved = script && script.scenes.every((s) => s.approved);
  const approvedCount = script ? script.scenes.filter((s) => s.approved).length : 0;
  const totalScenes = script ? script.scenes.length : 0;
  
  // Check if all scenes have both audio and images (required for video rendering)
  const allScenesHaveAudioAndImages = script && script.scenes.every((s) => s.audioUrl && s.imageUrl);
  const scenesWithAudio = script ? script.scenes.filter((s) => s.audioUrl).length : 0;
  const allScenesHaveAudio = script && script.scenes.every((s) => s.audioUrl);

  const combineAudio = useCallback(async () => {
    if (!script || !projectId) return;
    
    try {
      setCombiningAudio(true);

      const sceneIds: string[] = [];
      const sceneAudioUrls: string[] = [];

      script.scenes.forEach((scene) => {
        if (scene.audioUrl) {
          // Ensure we're using the correct URL format (not blob URLs)
          const audioUrl = scene.audioUrl.startsWith('blob:') ? '' : scene.audioUrl;
          if (audioUrl) {
            sceneIds.push(scene.id);
            sceneAudioUrls.push(audioUrl);
          }
        }
      });

      if (sceneIds.length === 0) {
        onError("No audio files found to combine.");
        return;
      }

      const result = await podcastApi.combineAudio({
        projectId,
        sceneIds,
        sceneAudioUrls,
      });

      // Store combined audio result for preview
      setCombinedAudioResult({
        url: result.combined_audio_url,
        filename: result.combined_audio_filename,
        duration: result.total_duration,
        sceneCount: result.scene_count,
      });

      // Download the combined audio as blob (for authenticated endpoints)
      try {
        // Normalize path
        let audioPath = result.combined_audio_url.startsWith('/') 
          ? result.combined_audio_url 
          : `/${result.combined_audio_url}`;
        
        // Ensure it's a podcast audio endpoint
        if (!audioPath.includes('/api/podcast/audio/')) {
          const filename = audioPath.split('/').pop() || result.combined_audio_filename;
          audioPath = `/api/podcast/audio/${filename}`;
        }

        // Remove query parameters if present
        audioPath = audioPath.split('?')[0];

        // Fetch as blob using authenticated client
        const response = await aiApiClient.get(audioPath, {
          responseType: 'blob',
        });

        // Create blob URL and download
        const blob = response.data;
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = result.combined_audio_filename || `podcast-episode-${projectId.slice(-8)}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 100);
      } catch (downloadError) {
        console.error('Failed to download combined audio:', downloadError);
        onError('Failed to download audio file. You can try downloading again from the preview.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to combine audio";
      onError(`Failed to combine audio: ${message}`);
    } finally {
      setCombiningAudio(false);
    }
  }, [script, projectId, onError]);

  return (
    <ScriptEditorProvider
      projectId={projectId}
      idea={idea}
      rawResearch={rawResearch}
      knobs={knobs}
      speakers={speakers}
      durationMinutes={durationMinutes}
      initialScript={script}
      podcastMode={podcastMode}
      analysis={analysis}
      outline={outline}
      onScriptChange={(s) => {
        setScript(s);
        onScriptChange(s);
      }}
      onError={onError}
    >
      <Box sx={{ mt: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <SecondaryButton onClick={onBackToResearch} startIcon={<ArrowBackIcon />}>
            Back to Research
          </SecondaryButton>
        </Stack>

      {loading && (
        <Alert 
          severity="info" 
          icon={<CircularProgress size={20} />} 
          sx={{ 
            mb: 3,
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: 2,
            boxShadow: "0 1px 2px rgba(99, 102, 241, 0.05)",
            "& .MuiAlert-icon": {
              color: "#6366f1",
            },
          }}
        >
          <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 500 }}>
            Generating script with AI... This may take a moment.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 2,
            boxShadow: "0 1px 2px rgba(239, 68, 68, 0.05)",
            "& .MuiAlert-icon": {
              color: "#ef4444",
            },
          }}
        >
          <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 500 }}>
            {error}
          </Typography>
        </Alert>
      )}

      {script && (
        <Stack spacing={3}>
          <Alert 
            severity="info" 
            sx={{ 
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: 2,
              boxShadow: "0 1px 2px rgba(99, 102, 241, 0.05)",
              "& .MuiAlert-icon": {
                color: "#6366f1",
              },
            }}
          >
            <Typography variant="body2" sx={{ color: "#0f172a", fontWeight: 500, lineHeight: 1.6 }}>
              <strong style={{ fontWeight: 600 }}>Approval Required:</strong> Each scene must be approved before rendering. Review and edit lines as needed, then approve each scene.
            </Typography>
          </Alert>

          <BrollInfoPanel
            activeScript={script}
            generatingChartId={undefined}
            generateChartPreviews={undefined}
            regenerateChart={undefined}
            removeChart={undefined}
            scenesWithCharts={script.scenes.filter((s) => s.chart_data && Object.keys(s.chart_data).length > 0).length}
          />

          <Stack spacing={2}>
            {script.scenes.map((scene, idx) => (
              <GlassyCard
                key={scene.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
              >
                <SceneEditor
                  scene={scene}
                  onUpdateScene={updateScene}
                  onApprove={approveScene}
                  onDelete={deleteScene}
                  knobs={knobs}
                  approvingSceneId={approvingSceneId}
                  generatingAudioId={generatingAudioId}
                  totalScenes={script.scenes.length}
                  sceneIndex={idx}
                  onAudioGenerationStart={(sceneId) => {
                    setGeneratingAudioId(sceneId);
                  }}
                  onAudioGenerated={async (sceneId, audioUrl) => {
                    setGeneratingAudioId(null);
                    // Use functional update to ensure we're working with latest state
                    // Ensure scene is marked as approved and has audioUrl
                    setScript((currentScript) => {
                      if (!currentScript) return currentScript;
                      const updatedScenes = currentScript.scenes.map((s) =>
                        s.id === sceneId ? { ...s, audioUrl, approved: true } : s
                      );
                      const updatedScript = { ...currentScript, scenes: updatedScenes };
                      emitScriptChange(updatedScript);
                      return updatedScript;
                    });
                  }}
                  idea={idea}
                  projectId={projectId}
                  avatarUrl={avatarUrl}
                  analysis={analysis}
                />
              </GlassyCard>
            ))}
          </Stack>

          <Paper
            sx={{
              p: 3.5,
              background: allApproved 
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)"
                : "#ffffff",
              border: allApproved 
                ? "2px solid rgba(16, 185, 129, 0.25)" 
                : "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: 3,
              boxShadow: allApproved
                ? "0 4px 6px rgba(16, 185, 129, 0.08), 0 8px 24px rgba(16, 185, 129, 0.06)"
                : "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1.5, color: "#0f172a", fontWeight: 600, fontSize: "1.1rem" }}>
                  <CheckCircleIcon fontSize="small" sx={{ color: allApproved ? "#10b981" : "#94a3b8", fontSize: "1.25rem" }} />
                  Approval Status
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 400, lineHeight: 1.6 }}>
                  {approvedCount} of {totalScenes} scenes approved
                  {allScenesHaveAudioAndImages && " • All scenes ready for video rendering"}
                  {!allScenesHaveAudioAndImages && allApproved && " • Generate images for all scenes to enable video rendering"}
                  {!allApproved && " — Approve all scenes first"}
                </Typography>
                {!allScenesHaveAudioAndImages && (
                  <LinearProgress
                    variant="determinate"
                    value={
                      allScenesHaveAudioAndImages
                        ? 100
                        : script
                        ? (script.scenes.filter((s) => s.audioUrl && s.imageUrl).length / totalScenes) * 100
                        : 0
                    }
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                )}
              </Box>
              <PrimaryButton
                onClick={() => script && onProceedToRendering(script)}
                disabled={!allScenesHaveAudioAndImages}
                startIcon={<PlayArrowIcon />}
                tooltip={
                  !allScenesHaveAudioAndImages
                    ? "Generate audio and images for all scenes to proceed to video rendering"
                    : "Proceed to video rendering (all scenes have audio and images)"
                }
              >
                Proceed to Rendering
              </PrimaryButton>
            </Stack>
          </Paper>

          {/* Download Audio-Only Podcast Section */}
          {allScenesHaveAudio && (
            <Paper
              sx={{
                p: 3,
                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                border: "1px solid rgba(102, 126, 234, 0.15)",
                borderRadius: 2,
              }}
            >
              <Stack spacing={3}>
                <Typography variant="h6" sx={{ color: "#0f172a", fontWeight: 600 }}>
                  Download Audio-Only Podcast
                </Typography>
                
                {!combinedAudioResult ? (
                  <>
                    <PrimaryButton
                      onClick={combineAudio}
                      disabled={combiningAudio}
                      loading={combiningAudio}
                      startIcon={<DownloadIcon />}
                      tooltip="Combine all scene audio files into a single podcast episode"
                      sx={{
                        minWidth: 280,
                        fontSize: "1rem",
                        py: 1.5,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        "&:hover": {
                          background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                        },
                      }}
                    >
                      {combiningAudio ? "Combining Audio..." : "Download Audio-Only Podcast"}
                    </PrimaryButton>
                    <Typography variant="caption" sx={{ color: "#64748b", fontStyle: "italic" }}>
                      This will combine all {scenesWithAudio} scene audio files into one complete podcast episode.
                    </Typography>
                  </>
                ) : (
                  <Stack spacing={2}>
                    {/* Success Alert */}
                    <Alert
                      severity="success"
                      sx={{
                        background: alpha("#10b981", 0.1),
                        border: "1px solid rgba(16,185,129,0.3)",
                        "& .MuiAlert-icon": { color: "#10b981" },
                      }}
                    >
                      <Typography variant="body2" sx={{ color: "#059669", fontWeight: 500 }}>
                        ✅ Combined audio generated successfully! ({combinedAudioResult.sceneCount} scenes,{" "}
                        {Math.round(combinedAudioResult.duration)}s)
                      </Typography>
                    </Alert>

                    {/* Combined Audio Preview */}
                    <InlineAudioPlayer audioUrl={combinedAudioResult.url} title="Complete Podcast Episode" />

                    {/* Action Buttons */}
                    <Stack direction="row" spacing={2}>
                      <SecondaryButton
                        onClick={async () => {
                          try {
                            // Normalize path
                            let audioPath = combinedAudioResult.url.startsWith('/') 
                              ? combinedAudioResult.url 
                              : `/${combinedAudioResult.url}`;
                            
                            // Ensure it's a podcast audio endpoint
                            if (!audioPath.includes('/api/podcast/audio/')) {
                              const filename = audioPath.split('/').pop() || combinedAudioResult.filename;
                              audioPath = `/api/podcast/audio/${filename}`;
                            }

                            // Remove query parameters if present
                            audioPath = audioPath.split('?')[0];

                            // Fetch as blob using authenticated client
                            const response = await aiApiClient.get(audioPath, {
                              responseType: 'blob',
                            });

                            // Create blob URL and download
                            const blob = response.data;
                            const blobUrl = URL.createObjectURL(blob);
                            
                            const link = document.createElement("a");
                            link.href = blobUrl;
                            link.download = combinedAudioResult.filename || `podcast-episode-${projectId.slice(-8)}.mp3`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            // Clean up blob URL after a delay
                            setTimeout(() => {
                              URL.revokeObjectURL(blobUrl);
                            }, 100);
                          } catch (error) {
                            console.error('Failed to download audio:', error);
                            onError('Failed to download audio file. Please try again.');
                          }
                        }}
                        startIcon={<DownloadIcon />}
                        tooltip="Download the combined audio file again"
                      >
                        Download Again
                      </SecondaryButton>
                      <SecondaryButton
                        onClick={() => {
                          setCombinedAudioResult(null);
                          combineAudio();
                        }}
                        disabled={combiningAudio}
                        loading={combiningAudio}
                        startIcon={<RefreshIcon />}
                        tooltip="Regenerate combined audio (useful if scenes were updated)"
                      >
                        Regenerate
                      </SecondaryButton>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
    </Box>
    </ScriptEditorProvider>
  );
};
