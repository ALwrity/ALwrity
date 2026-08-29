import { useState, useEffect, useRef, useCallback } from "react";
import { Script, Knobs, Job, RenderJobResult, TaskStatus, VideoGenerationSettings } from "../types";
import { podcastApi, getCachedVoiceCloneInfo } from "../../../services/podcastApi";

interface UseRenderQueueProps {
  script: Script;
  jobs: Job[];
  knobs: Knobs;
  projectId: string;
  bible?: any | null;
  analysis?: any | null;
  budgetCap?: number;
  avatarImageUrl?: string | null;
  onUpdateJob: (sceneId: string, updates: Partial<Job>) => void;
  onUpdateScript?: (script: Script) => void;
  onError: (message: string) => void;
}

const getSceneVoiceEmotion = (knobs: Knobs) => knobs.voice_emotion || "neutral";

export const useRenderQueue = ({
  script,
  jobs,
  knobs,
  projectId,
  bible,
  analysis,
  budgetCap,
  avatarImageUrl,
  onUpdateJob,
  onUpdateScript,
  onError,
}: UseRenderQueueProps) => {
  const [rendering, setRendering] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [combiningAudio, setCombiningAudio] = useState(false);
  const [combinedAudioResult, setCombinedAudioResult] = useState<{
    url: string;
    filename: string;
    duration: number;
    sceneCount: number;
  } | null>(null);
  const [combiningVideos, setCombiningVideos] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [combiningProgress, setCombiningProgress] = useState<{ progress: number; message: string } | null>(null);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollingErrorCounts = useRef<Map<string, number>>(new Map());

  // Cleanup polling intervals on unmount
  useEffect(() => {
    const intervals = pollingIntervals.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
      pollingErrorCounts.current.clear();
    };
  }, []);

  // Initialize jobs if empty (audio/image only) OR sync with script scenes
  useEffect(() => {
    // Always sync jobs with script scenes - this ensures render queue shows current audio/image
    if (script.scenes.length > 0) {
      script.scenes.forEach((s) => {
        const hasExistingAudio = Boolean(s.audioUrl);
        const hasExistingImage = Boolean(s.imageUrl);
        const isReady = hasExistingAudio;
        
        // Create job from scene data
        const jobFromScene: Job = {
          sceneId: s.id,
          title: s.title,
          status: isReady ? ("completed" as const) : ("idle" as const),
          progress: isReady ? 100 : 0,
          previewUrl: null,
          finalUrl: hasExistingAudio ? s.audioUrl || null : null,
          imageUrl: hasExistingImage ? s.imageUrl || null : null,
          jobId: null,
        };
        
        // Update job with scene's audio/image data
        onUpdateJob(s.id, jobFromScene);
      });
    }
  }, [script.scenes, onUpdateJob]);

  // Load final video URL from project on mount (for persistence across reloads)
  useEffect(() => {
    if (!projectId) return;

    podcastApi
      .loadProject(projectId)
      .then((project) => {
        if (project.final_video_url) {
          console.log("[useRenderQueue] Loaded final video URL from project:", project.final_video_url);
          setFinalVideoUrl(project.final_video_url);
        }
      })
      .catch((error) => {
        console.error("[useRenderQueue] Failed to load project for final video URL:", error);
        // Don't show error to user - this is just for restoring state
      });
  }, [projectId]);

  // Always try to attach existing videos to scenes (even after reloads)
  // But skip if job already has imageUrl - indicates user just came from script phase
  useEffect(() => {
    if (script.scenes.length === 0) return;

    podcastApi
      .listVideos(projectId)
      .then((result) => {
        const videoMap = new Map<number, string>();
        
        result.videos.forEach((video) => {
          // Use the most recent video for each scene number
          if (!videoMap.has(video.scene_number)) {
            // Store the raw video URL - SceneCard will handle authentication via blob loading
            videoMap.set(video.scene_number, video.video_url);
          }
        });

        script.scenes.forEach((scene) => {
          const sceneNumberMatch = scene.id.match(/\d+/);
          const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[0], 10) : null;
          
          if (sceneNumber === null) return;

          const videoUrl = videoMap.get(sceneNumber);
          if (!videoUrl) return;

          const job = jobs.find((j) => j.sceneId === scene.id);

          // Skip if job already has imageUrl from script phase - don't override with old video
          if (job?.imageUrl) {
            if (process.env.NODE_ENV === 'development') console.log("[useRenderQueue] Skipping old video - job has imageUrl from script phase:", scene.id, "imageUrl:", (job.imageUrl || '').split('?')[0]);
            return;
          }

          // Job has no imageUrl - this could be from page reload or old state
          console.log("[useRenderQueue] Job missing imageUrl, checking for old video:", scene.id, "job:", job);

          // Only attach old video if job has NO content at all (no image, no video, no audio)
          // If job has finalUrl (audio) or imageUrl from script phase, don't attach old video
          const isJobEmpty = !job || (!job.imageUrl && !job.videoUrl && !job.finalUrl);
          if (!isJobEmpty) {
            if (process.env.NODE_ENV === 'development') console.log("[useRenderQueue] Skipping old video - job has content already:", scene.id);
            return;
          }

          // Avoid redundant updates
          if (job?.videoUrl === videoUrl) return;

          onUpdateJob(scene.id, {
            sceneId: scene.id,
            title: scene.title,
            videoUrl,
            status: "completed" as const,
            progress: 100,
          });
        });
      })
      .catch((error) => {
        console.error("[useRenderQueue] Failed to list existing videos:", error);
      });
  }, [projectId, script.scenes, jobs, onUpdateJob]);

  // Periodic check to rescue videos that were generated but not detected by polling
  useEffect(() => {
    if (rendering && script.scenes.length > 0) {
      const rescueInterval = setInterval(async () => {
        // Check for videos every 2 minutes while rendering is active
        try {
          const videoList = await podcastApi.listVideos(projectId);
          
          const videoMap = new Map<number, string>();
          videoList.videos.forEach((video) => {
            if (!videoMap.has(video.scene_number)) {
              // Store the raw video URL - SceneCard will handle authentication via blob loading
              videoMap.set(video.scene_number, video.video_url);
            }
          });

          // Update jobs for scenes that have videos but no videoUrl set
          script.scenes.forEach((scene) => {
            const sceneNumberMatch = scene.id.match(/\d+/);
            const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[0], 10) : null;
            if (sceneNumber !== null) {
              const videoUrl = videoMap.get(sceneNumber);
              const job = jobs.find((j) => j.sceneId === scene.id);
              
              if (videoUrl) {
                if (!job) {
                  onUpdateJob(scene.id, { 
                    sceneId: scene.id,
                    title: scene.title,
                    status: "completed" as const,
                    progress: 100,
                    videoUrl,
                  });
                } else if (!job.videoUrl) {
                  onUpdateJob(scene.id, { videoUrl, status: "completed" as const, progress: 100 });
                  // If this was the rendering scene, stop rendering
                  if (rendering === scene.id) {
                    setRendering(null);
                  }
                }
              }
            }
          });
        } catch (error) {
          console.error("[useRenderQueue] Failed to rescue videos:", error);
        }
      }, 120000); // Check every 2 minutes

      return () => clearInterval(rescueInterval);
    }
  }, [rendering, script.scenes, jobs, projectId, onUpdateJob]);

  const getScene = useCallback((sceneId: string) => script.scenes.find((s) => s.id === sceneId), [script.scenes]);

  const pollTaskStatus = useCallback(async (taskId: string, sceneId: string) => {
    try {
      const status: TaskStatus | null = await podcastApi.pollTaskStatus(taskId);

      // Handle null response (task not found)
      if (!status) {
        const errorCount = (pollingErrorCounts.current.get(sceneId) || 0) + 1;
        pollingErrorCounts.current.set(sceneId, errorCount);
        
        // Stop polling after 3 consecutive "task not found" errors
        if (errorCount >= 3) {
          onUpdateJob(sceneId, { status: "failed", progress: 0 });
          const interval = pollingIntervals.current.get(sceneId);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(sceneId);
          }
          pollingErrorCounts.current.delete(sceneId);
          setRendering(null);
          onError("Video generation task not found. The task may have expired or been cancelled.");
          return true; // Stop polling
        }
        return false; // Continue polling (might be transient)
      }

      // Reset error count on successful poll
      pollingErrorCounts.current.delete(sceneId);

      onUpdateJob(sceneId, {
        progress: status.progress ?? 0,
        status: status.status === "completed" ? "completed" : status.status === "failed" ? "failed" : "running",
      });

      // Check for completion - handle both "completed" and "processing" with 100% progress
      const isCompleted = status.status === "completed" || (status.status === "processing" && status.progress === 100);
      
      if (isCompleted) {
        console.log("[useRenderQueue] Task completed, checking for video URL", {
          status: status.status,
          progress: status.progress,
          hasResult: !!status.result,
          result: status.result,
        });

        let videoUrl = null;
        let cost = 0;

        // Try to get video URL from result
        if (status.result) {
          const result = status.result;
          videoUrl = result.video_url;
          cost = result.cost || 0;
        }

        // If no video URL in result, try to rescue from video list
        if (!videoUrl) {
          console.log("[useRenderQueue] No video_url in result! Attempting to rescue from file system...");
          const sceneNumberMatch = getScene(sceneId)?.id.match(/\d+/);
          const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[0], 10) : null;
          
          if (sceneNumber !== null) {
            try {
              const videoList = await podcastApi.listVideos(projectId);
              const sceneVideo = videoList.videos.find((v) => v.scene_number === sceneNumber);
              if (sceneVideo) {
                videoUrl = sceneVideo.video_url;
                console.log("[useRenderQueue] Successfully rescued video from file system", { sceneNumber, videoUrl });
              }
            } catch (err) {
              console.error("[useRenderQueue] Failed to rescue video:", err);
            }
          }
        }

        // If we have a video URL, mark as completed
        if (videoUrl) {
          console.log("[useRenderQueue] Video generation completed successfully", { videoUrl, cost });
          
          // Store the raw video URL - SceneCard will handle authentication via blob loading
          onUpdateJob(sceneId, {
            status: "completed",
            progress: 100,
            videoUrl,
            cost,
          });

          const interval = pollingIntervals.current.get(sceneId);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(sceneId);
          }
          setRendering(null);
          return true; // Stop polling
        } else {
          // Mark as failed if we can't find the video URL
          console.error("[useRenderQueue] Task completed but no video URL found");
          onUpdateJob(sceneId, { status: "failed", progress: 0 });
          const interval = pollingIntervals.current.get(sceneId);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(sceneId);
          }
          pollingErrorCounts.current.delete(sceneId);
          setRendering(null);
          onError("Video generation completed but no video URL was found. Please try generating again.");
          return true; // Stop polling
        }
      } else if (status.status === "failed") {
        // Extract user-friendly error message
        let errorMessage = "Video generation failed";
        if (status.error) {
          // Try to extract meaningful error from various formats
          const errorStr = status.error;
          if (errorStr.includes("Insufficient credits")) {
            errorMessage = "Video generation failed: Insufficient WaveSpeed credits. Please top up your account.";
          } else if (errorStr.includes("HTTPException") || errorStr.includes("502")) {
            // Extract the actual error message from HTTPException details
            const match = errorStr.match(/message[":\s]+"([^"]+)"/i) || errorStr.match(/detail[":\s]+"([^"]+)"/i);
            if (match && match[1]) {
              errorMessage = `Video generation failed: ${match[1]}`;
            } else {
              errorMessage = `Video generation failed: ${errorStr}`;
            }
          } else {
            errorMessage = `Video generation failed: ${errorStr}`;
          }
        }

        onUpdateJob(sceneId, { status: "failed", progress: 0 });
        const interval = pollingIntervals.current.get(sceneId);
        if (interval) {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);
        }
        pollingErrorCounts.current.delete(sceneId);
        setRendering(null);
        onError(errorMessage);
        return true; // Stop polling
      }

      return false; // Continue polling
    } catch (error) {
      console.error("Error polling task status:", error);
      const errorCount = (pollingErrorCounts.current.get(sceneId) || 0) + 1;
      pollingErrorCounts.current.set(sceneId, errorCount);
      
      // Stop polling after 5 consecutive network errors
      if (errorCount >= 5) {
        onUpdateJob(sceneId, { status: "failed", progress: 0 });
        const interval = pollingIntervals.current.get(sceneId);
        if (interval) {
          clearInterval(interval);
          pollingIntervals.current.delete(sceneId);
        }
        pollingErrorCounts.current.delete(sceneId);
        setRendering(null);
        const errorMsg = error instanceof Error ? error.message : String(error);
        onError(`Video generation failed: Unable to check status. ${errorMsg}`);
        return true; // Stop polling
      }
      return false; // Continue polling (might be transient network error)
    }
  }, [onUpdateJob, onError]);

  const startPolling = useCallback((taskId: string, sceneId: string) => {
    const existingInterval = pollingIntervals.current.get(sceneId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(async () => {
      const isComplete = await pollTaskStatus(taskId, sceneId);
      if (isComplete) {
        clearInterval(interval);
        pollingIntervals.current.delete(sceneId);
      }
    }, 3000);

    pollingIntervals.current.set(sceneId, interval);
  }, [pollTaskStatus]);

  const runRender = useCallback(async (sceneId: string, mode: "preview" | "full") => {
    if (rendering && rendering !== sceneId) return;
    const job = jobs.find((j) => j.sceneId === sceneId);
    if (job && job.status !== "idle") return;
    const scene = getScene(sceneId);
    if (!scene) return;

    const textLength = scene.lines.map((l) => l.text).join(" ").length;
    const estimatedCost = (textLength / 1000) * 0.05;

    if (budgetCap && budgetCap > 0) {
      const currentSpent = jobs
        .filter((j) => j.status === "completed" && j.cost)
        .reduce((sum, j) => sum + (j.cost || 0), 0);

      if (currentSpent + estimatedCost > budgetCap) {
        onError(`Budget cap exceeded. Estimated cost: $${estimatedCost.toFixed(4)}, Budget remaining: $${(budgetCap - currentSpent).toFixed(2)}`);
        return;
      }
    }

    setRendering(sceneId);
    onUpdateJob(sceneId, {
      status: mode === "preview" ? "previewing" : "running",
      progress: mode === "preview" ? 25 : 40,
    });

    try {
      const cachedClone = getCachedVoiceCloneInfo();
      const result: RenderJobResult = await podcastApi.renderSceneAudio({
        scene,
        voiceId: knobs.voice_id || "Wise_Woman",
        customVoiceId: knobs.custom_voice_id || cachedClone?.customVoiceId,
        useVoiceClone: knobs.is_voice_clone || cachedClone?.isVoiceClone || false,
        voiceSampleUrl: knobs.voice_sample_url || cachedClone?.voiceSampleUrl || undefined,
        voiceCloneEngine: knobs.voice_clone_engine || cachedClone?.engine || undefined,
        emotion: scene.emotion || getSceneVoiceEmotion(knobs),
        speed: knobs.voice_speed,
      });

      const updates: Partial<Job> = {
        status: "completed",
        progress: 100,
        cost: result.cost,
        provider: result.provider,
        voiceId: result.voiceId,
        fileSize: result.fileSize,
      };

      if (mode === "preview") {
        updates.previewUrl = result.audioUrl;
        window.open(result.audioUrl, "_blank");
      } else {
        updates.finalUrl = result.audioUrl;
        try {
          await podcastApi.saveAudioToAssetLibrary({
            audioUrl: result.audioUrl,
            filename: result.audioFilename,
            title: `${scene.title} - ${projectId}`,
            description: `Podcast episode scene audio: ${scene.title}`,
            projectId,
            sceneId,
            cost: result.cost,
            provider: result.provider,
            model: result.model,
            fileSize: result.fileSize,
          });
        } catch (assetError) {
          console.error("Failed to save to asset library:", assetError);
        }
      }

      onUpdateJob(sceneId, updates);
    } catch (error) {
      onUpdateJob(sceneId, { status: "failed", progress: 0 });
      const message = error instanceof Error ? error.message : "Render failed";
      onError(message);
    } finally {
      setRendering(null);
    }
  }, [rendering, jobs, getScene, knobs, budgetCap, projectId, onUpdateJob, onError]);

  const runImageGeneration = useCallback(async (sceneId: string) => {
    if (generatingImage && generatingImage !== sceneId) return;
    const scene = getScene(sceneId);
    if (!scene) return;

    setGeneratingImage(sceneId);
    try {
      const sceneContent = scene.lines.map((line) => line.text).join(" ");

      // ── Ensure presenter reference image exists before generating any scene ──
      // generatePresenterReference is idempotent: if the reference already exists
      // on the backend (was_cached=true), it returns immediately with no extra cost.
      // We only call it when a project_id is available (i.e., project is saved to DB)
      // and we're not on Path A (user uploaded their own avatar).
      if (projectId && !avatarImageUrl) {
        try {
          await podcastApi.generatePresenterReference({
            projectId,
            bible,
            idea: undefined, // project idea not needed; character lock already in DB
          });
        } catch (refErr) {
          // Non-fatal: if reference generation fails, scene generation continues
          // using Path B2 text-only fallback automatically.
          console.warn("[useRenderQueue] Presenter reference generation failed (non-fatal):", refErr);
        }
      }

      const result = await podcastApi.generateSceneImage({
        sceneId: scene.id,
        sceneTitle: scene.title,
        projectId: projectId,
        sceneContent: sceneContent,
        sceneEmotion: scene.emotion,
        cameraAngle: scene.camera_angle,
        visualAtmosphere: scene.visual_atmosphere,
        baseAvatarUrl: avatarImageUrl || undefined, // Use base avatar if available (Path A gate)
        bible: bible,
        width: 1024,
        height: 1024,
      });

      // Update job with image URL
      onUpdateJob(sceneId, {
        imageUrl: result.image_url,
      });

      // Also update the scene's imageUrl so it persists
      if (onUpdateScript) {
        const updatedScenes = script.scenes.map((s) =>
          s.id === sceneId ? { ...s, imageUrl: result.image_url } : s
        );
        onUpdateScript({ ...script, scenes: updatedScenes });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image generation failed";
      onError(message);
    } finally {
      setGeneratingImage(null);
    }
  }, [generatingImage, getScene, avatarImageUrl, onUpdateJob, onError, script, projectId, bible]);


  const runVideoRender = useCallback(
    async (sceneId: string, settings?: VideoGenerationSettings) => {
      if (rendering && rendering !== sceneId) {
        return;
      }

      const scene = getScene(sceneId);
      if (!scene) {
        return;
      }

      // Guard: require image and audio before calling expensive video gen
      const sceneImageUrl = scene.imageUrl || avatarImageUrl;
      if (!sceneImageUrl) {
        onError("Scene image is required for video generation. Please generate images for scenes first.");
        return;
      }

      const job = jobs.find((j) => j.sceneId === sceneId);
      // Use job.finalUrl if available, otherwise fall back to scene.audioUrl (from Script Editor)
      const audioUrl = job?.finalUrl || scene.audioUrl;
      if (!audioUrl || audioUrl.startsWith("blob:")) {
        onError("Please generate audio first before creating video.");
        return;
      }

      // Guard: ensure every scene has audio and image before enabling render queue video
      const allScenesHaveAudio = script.scenes.every((s) => s.audioUrl && !s.audioUrl.startsWith("blob:"));
      const allScenesHaveImage = script.scenes.every((s) => s.imageUrl);
      if (!allScenesHaveAudio || !allScenesHaveImage) {
        onError("Please ensure all scenes have both audio and image before generating video.");
        return;
      }

      // Resolution & simple cost heuristic (default 480p for lower cost)
      const targetResolution: "480p" | "720p" =
        settings?.resolution || (knobs.resolution as "480p" | "720p") || "480p";
      const baseCost = 0.3; // 5s at 720p
      const estimatedCost = targetResolution === "480p" ? baseCost / 2 : baseCost;

      if (budgetCap && budgetCap > 0) {
        const currentSpent = jobs
          .filter((j) => j.status === "completed" && j.cost)
          .reduce((sum, j) => sum + (j.cost || 0), 0);

        if (currentSpent + estimatedCost > budgetCap) {
          onError(
            `Budget cap exceeded. Estimated cost: $${estimatedCost.toFixed(
              2
            )}, Budget remaining: $${(budgetCap - currentSpent).toFixed(2)}`
          );
          return;
        }
      }

      setRendering(sceneId);
      onUpdateJob(sceneId, {
        status: "running",
        progress: 5,
      });

      try {
        if (process.env.NODE_ENV === 'development') console.log("[useRenderQueue] Starting video generation", {
          sceneId,
          sceneTitle: scene.title,
          resolution: targetResolution,
        });

        const result = await podcastApi.generateVideo({
          projectId,
          sceneId,
          sceneTitle: scene.title,
          audioUrl,
          avatarImageUrl: sceneImageUrl,
          bible: bible,
          analysis: analysis, // Pass analysis for enhanced prompt
          sceneImagePrompt: scene.imagePrompt || undefined, // Original image generation prompt
          sceneNarration: scene.lines?.map((l: any) => l.text).join(" ").slice(0, 200) || undefined,
          resolution: targetResolution,
          prompt: settings?.prompt || undefined,
          seed: settings?.seed ?? -1,
          maskImageUrl: settings?.maskImageUrl || undefined,
          sceneEmotion: scene.emotion || undefined,
          sceneVisualAtmosphere: scene.visual_atmosphere || undefined,
        });

        if (!result.taskId) {
          throw new Error("Backend did not return a task ID. Response: " + JSON.stringify(result));
        }

        onUpdateJob(sceneId, {
          taskId: result.taskId,
          status: "running",
          progress: 5,
        });

        startPolling(result.taskId, sceneId);
      } catch (error) {
        onUpdateJob(sceneId, { status: "failed", progress: 0 });
        const message = error instanceof Error ? error.message : "Video generation failed";
        onError(message);
      }
    },
    [rendering, getScene, avatarImageUrl, jobs, budgetCap, projectId, knobs, onUpdateJob, onError, script.scenes, startPolling]
  );

  const combineAudio = useCallback(async () => {
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

      jobs.forEach((job) => {
        // Prefer finalUrl over previewUrl, and ensure it's not a blob URL
        const audioUrl = job.finalUrl || job.previewUrl;
        if (audioUrl && !audioUrl.startsWith('blob:') && !sceneAudioUrls.includes(audioUrl)) {
          sceneIds.push(job.sceneId);
          sceneAudioUrls.push(audioUrl);
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

      // Auto-download the combined audio
      const link = document.createElement("a");
      link.href = result.combined_audio_url;
      link.download = `podcast-episode-${projectId.slice(-8)}.mp3`;
      link.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to combine audio";
      onError(`Failed to combine audio: ${message}`);
    } finally {
      setCombiningAudio(false);
    }
  }, [script.scenes, jobs, projectId, onError]);

  const combineFinalVideo = useCallback(async () => {
    try {
      setCombiningVideos(true);
      onError("");

      // Collect all scene video URLs
      const sceneVideoUrls: string[] = [];
      for (const scene of script.scenes) {
        const job = jobs.find((j) => j.sceneId === scene.id);
        if (!job?.videoUrl) {
          throw new Error(`Scene "${scene.title}" is missing a video. Please generate videos for all scenes first.`);
        }
        // Remove blob URLs and query params - use the API path only
        let videoUrl = job.videoUrl;
        if (videoUrl.startsWith("blob:")) {
          throw new Error(`Scene "${scene.title}" has a blob URL. Cannot combine blob URLs. Please use API URLs.`);
        }
        videoUrl = videoUrl.split("?")[0]; // Remove query params
        sceneVideoUrls.push(videoUrl);
      }

      if (process.env.NODE_ENV === 'development') console.log("[combineFinalVideo] Starting combination with", sceneVideoUrls.length, "videos");

      // Start combination task
      const result = await podcastApi.combineVideos({
        projectId,
        sceneVideoUrls,
        podcastTitle: script.scenes[0]?.title || "Podcast",
      });

      console.log("[combineFinalVideo] Task created:", result.taskId);

      // Poll for completion
      const taskId = result.taskId;
      let done = false;
      let pollCount = 0;
      const maxPolls = 300; // 10 minutes max (300 * 2 seconds) - encoding can take time
      let lastProgress = 0;
      let lastMessage = "Starting video combination...";
      
      while (!done && pollCount < maxPolls) {
        await new Promise((r) => setTimeout(r, 2000)); // Poll every 2 seconds
        pollCount++;
        
        const status = await podcastApi.pollTaskStatus(taskId);
        
        // Update progress and message for user feedback
        if (status) {
          const currentProgress = status.progress ?? 0;
          const currentMessage = status.message || "Processing...";
          
          // Update UI with progress
          setCombiningProgress({
            progress: currentProgress,
            message: currentMessage,
          });
          
          // Only log if progress or message changed to reduce noise
          if (currentProgress !== lastProgress || currentMessage !== lastMessage) {
            console.log(
              `[combineFinalVideo] Poll ${pollCount}: ${status.status} | ` +
              `Progress: ${currentProgress.toFixed(1)}% | Message: ${currentMessage}`
            );
            lastProgress = currentProgress;
            lastMessage = currentMessage;
          }
        } else {
          console.log(`[combineFinalVideo] Poll ${pollCount}: No status yet...`);
        }
        
        if (!status) {
          // Don't fail immediately - task might still be initializing
          if (pollCount < 10) {
            continue; // Wait up to 20 seconds for task to appear
          }
          console.error("[combineFinalVideo] Task not found after 10 polls");
          throw new Error("Task not found. Video combination may have failed on the server. Please try again.");
        }

        if (status.status === "completed") {
          done = true;
          const videoUrl = status.result?.video_url;
          if (!videoUrl) {
            console.error("[combineFinalVideo] No video URL in result:", status.result);
            throw new Error("Final video URL not found in result. Please contact support.");
          }
          console.log("[combineFinalVideo] Success! Video URL:", videoUrl);
          setFinalVideoUrl(videoUrl);
          
          // Save final video URL to project for persistence across reloads
          try {
            await podcastApi.saveProject(projectId, { final_video_url: videoUrl });
            console.log("[combineFinalVideo] Saved final video URL to project");
          } catch (error) {
            console.warn("[combineFinalVideo] Failed to save final video URL to project:", error);
            // Don't fail the operation if project save fails - video is still available
          }
        } else if (status.status === "failed") {
          const errorMsg = status.error || status.message || "Video combination failed";
          console.error("[combineFinalVideo] Task failed:", errorMsg);
          throw new Error(`Video combination failed: ${errorMsg}`);
        }
      }
      
      if (pollCount >= maxPolls) {
        throw new Error("Video combination timed out after 10 minutes. The video may still be processing. Please check back in a few minutes or try again.");
      }
    } catch (error: any) {
      console.error("[combineFinalVideo] Error:", error);
      
      // Extract detailed error message
      let message = "Failed to combine videos";
      
      if (error?.response?.data?.detail) {
        // Backend error with detail
        message = error.response.data.detail;
      } else if (error?.message) {
        // Standard error message
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      }
      
      console.error("[combineFinalVideo] Displaying error to user:", message);
      onError(message);
    } finally {
      setCombiningVideos(false);
      setCombiningProgress(null);
    }
  }, [script.scenes, jobs, projectId, onError]);

  // Delete scene functionality
  const deleteScene = useCallback(async (sceneId: string) => {
    if (!script) return;

    // Prevent deleting if it's the last scene
    if (script.scenes.length <= 1) {
      onError("Cannot delete the last scene. At least one scene is required.");
      return;
    }

    // Find the scene to delete
    const sceneToDelete = script.scenes.find(s => s.id === sceneId);
    if (!sceneToDelete) {
      onError("Scene not found.");
      return;
    }

    try {
      // Stop any ongoing polling for this scene
      const interval = pollingIntervals.current.get(sceneId);
      if (interval) {
        clearInterval(interval);
        pollingIntervals.current.delete(sceneId);
      }
      pollingErrorCounts.current.delete(sceneId);

      // If this scene is currently being rendered, stop it
      if (rendering === sceneId) {
        setRendering(null);
      }
      if (generatingImage === sceneId) {
        setGeneratingImage(null);
      }

      // Remove the scene from the script
      const updatedScenes = script.scenes.filter(scene => scene.id !== sceneId);
      const updatedScript = { ...script, scenes: updatedScenes };

      // Update the script state
      if (onUpdateScript) {
        onUpdateScript(updatedScript);
      }

      console.log(`[useRenderQueue] Deleted scene: ${sceneToDelete.title}`);
    } catch (error) {
      console.error("[useRenderQueue] Failed to delete scene:", error);
      onError("Failed to delete scene. Please try again.");
    }
  }, [script, rendering, generatingImage, onUpdateScript, onError]);

  return {
    rendering,
    generatingImage,
    combiningAudio,
    combinedAudioResult,
    combiningVideos,
    combiningProgress,
    finalVideoUrl,
    isBusy: Boolean(rendering),
    runRender,
    runImageGeneration,
    runVideoRender,
    combineAudio,
    combineFinalVideo,
    deleteScene,
  };
};

