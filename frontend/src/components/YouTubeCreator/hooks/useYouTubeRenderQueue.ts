import { useCallback, useEffect, useRef, useState } from 'react';
import {
  youtubeApi,
  Scene,
  SceneVideoRenderRequest,
  TaskStatus,
  VideoPlan,
} from '../../../services/youtubeApi';

type SceneStatus = 'idle' | 'running' | 'completed' | 'failed';

interface SceneVideoState {
  status: SceneStatus;
  progress: number;
  taskId?: string;
  error?: string;
  videoUrl?: string;
}

interface UseYouTubeRenderQueueParams {
  scenes: Scene[];
  videoPlan: VideoPlan | null;
  resolution: '480p' | '720p' | '1080p';
  onScenesUpdate: (updated: Scene[]) => void;
  onError?: (msg: string) => void;
  onInfo?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

interface UseYouTubeRenderQueueResult {
  sceneStatuses: Record<number, SceneVideoState>;
  finalVideoUrl: string | null;
  combining: boolean;
  combiningProgress: number;
  combiningMessage: string;
  runSceneVideo: (scene: Scene) => Promise<void>;
  combineVideos: () => Promise<void>;
}

const POLL_MS = 3000;

export function useYouTubeRenderQueue({
  scenes,
  videoPlan,
  resolution,
  onScenesUpdate,
  onError,
  onInfo,
  onSuccess,
}: UseYouTubeRenderQueueParams): UseYouTubeRenderQueueResult {
  const [sceneStatuses, setSceneStatuses] = useState<Record<number, SceneVideoState>>({});
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [combining, setCombining] = useState(false);
  const [combiningProgress, setCombiningProgress] = useState(0);
  const [combiningMessage, setCombiningMessage] = useState('Combining videos...');
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pollingErrorCounts = useRef<Map<string, number>>(new Map());

  const updateSceneStatus = useCallback((sceneNumber: number, updates: Partial<SceneVideoState>) => {
    setSceneStatuses((prev) => ({
      ...prev,
      [sceneNumber]: {
        ...prev[sceneNumber],
        status: prev[sceneNumber]?.status || 'idle',
        progress: prev[sceneNumber]?.progress || 0,
        ...updates,
      },
    }));
  }, []);

  const clearPolling = useCallback((taskId: string) => {
    const timers = pollingRefs.current;
    timers.forEach((interval, key) => {
      if (key === taskId) {
        clearInterval(interval);
        timers.delete(key);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((interval) => clearInterval(interval));
      pollingRefs.current.clear();
      pollingErrorCounts.current.clear();
    };
  }, []);

  const pollTask = useCallback(
    (taskId: string, sceneNumber: number) => {
      const interval = setInterval(async () => {
        try {
          const status: TaskStatus | null = await youtubeApi.getRenderStatus(taskId);

          // Handle null response (task not found) - matches podcast pattern
          if (!status) {
            const errorCount = (pollingErrorCounts.current.get(taskId) || 0) + 1;
            pollingErrorCounts.current.set(taskId, errorCount);
            
            // Stop polling after 3 consecutive "task not found" errors
            if (errorCount >= 3) {
              updateSceneStatus(sceneNumber, { status: 'failed', progress: 0 });
              clearPolling(taskId);
              pollingErrorCounts.current.delete(taskId);
              onError?.('Video generation task not found. The task may have expired or been cancelled.');
              return; // Stop polling
            }
            return; // Continue polling (might be transient)
          }

          // Reset error count on successful poll
          pollingErrorCounts.current.delete(taskId);

          const progress = status.progress ?? 0;
          updateSceneStatus(sceneNumber, {
            progress,
            status: status.status === 'completed' ? 'completed' : status.status === 'failed' ? 'failed' : 'running',
            taskId,
          });

          // Check for completion - handle both "completed" and "processing" with 100% progress
          const isCompleted = status.status === 'completed' || (status.status === 'processing' && status.progress === 100);
          
          if (isCompleted && status.result) {
            const videoUrl =
              status.result.video_url ||
              status.result.final_video_url ||
              status.result.scene_results?.[0]?.video_url ||
              null;

            if (!videoUrl) {
              console.error('[YouTubeRenderQueue] No video_url in result! Attempting to rescue from file system...', { result: status.result });
              // Try to rescue: check if video exists for this scene (will be handled by rescue logic)
              clearPolling(taskId);
              return; // Stop polling, rescue logic will handle it
            }
            
            updateSceneStatus(sceneNumber, {
              status: 'completed',
              progress: 100,
              videoUrl,
              taskId,
              error: undefined,
            });

            const updatedScenes = scenes.map((s) =>
              s.scene_number === sceneNumber
                ? {
                    ...s,
                    videoUrl,
                    video_generation:
                      status.result.generation ||
                      status.result.scene_results?.[0]?.generation ||
                      s.video_generation,
                  }
                : s
            );
            onScenesUpdate(updatedScenes);

            clearPolling(taskId);
            return; // Stop polling
          } else if (status.status === 'failed') {
            // Extract user-friendly error message
            let errorMessage = 'Video generation failed';
            if (status.error) {
              const errorStr = status.error;
              if (errorStr.includes('Insufficient credits')) {
                errorMessage = 'Video generation failed: Insufficient WaveSpeed credits. Please top up your account.';
              } else {
                errorMessage = `Video generation failed: ${errorStr}`;
              }
            }

            updateSceneStatus(sceneNumber, { status: 'failed', progress: 0, error: errorMessage, taskId });
            clearPolling(taskId);
            pollingErrorCounts.current.delete(taskId);
            onError?.(errorMessage);
            return; // Stop polling
          }

          // Continue polling for processing/running status
        } catch (error) {
          console.error('[YouTubeRenderQueue] Error polling task status:', error);
          const errorCount = (pollingErrorCounts.current.get(taskId) || 0) + 1;
          pollingErrorCounts.current.set(taskId, errorCount);
          
          // Stop polling after 5 consecutive network errors
          if (errorCount >= 5) {
            updateSceneStatus(sceneNumber, { status: 'failed', progress: 0 });
            clearPolling(taskId);
            pollingErrorCounts.current.delete(taskId);
            const errorMsg = error instanceof Error ? error.message : String(error);
            onError?.(`Video generation failed: Unable to check status. ${errorMsg}`);
            return; // Stop polling
          }
          // Continue polling (might be transient network error)
        }
      }, POLL_MS);

      pollingRefs.current.set(taskId, interval);
    },
    [clearPolling, onError, onScenesUpdate, scenes, updateSceneStatus]
  );

  // Load existing videos on mount (rescue mechanism for persistence across reloads)
  useEffect(() => {
    youtubeApi
      .listVideos()
      .then((result) => {
        if (!result.videos || result.videos.length === 0) return;

        const videoMap = new Map<number, string>();
        result.videos.forEach((video: any) => {
          const sceneNum = video.scene_number;
          if (sceneNum !== null && sceneNum !== undefined) {
            // Use the most recent video for each scene number
            if (!videoMap.has(sceneNum)) {
              videoMap.set(sceneNum, video.video_url);
            }
          }
        });

        // Update scenes with existing video URLs
        const updatedScenes = scenes.map((s) => {
          const videoUrl = videoMap.get(s.scene_number);
          if (videoUrl && !s.videoUrl) {
            return { ...s, videoUrl };
          }
          return s;
        });

        // Only update if we found videos
        const hasUpdates = updatedScenes.some((s, idx) => s.videoUrl !== scenes[idx].videoUrl);
        if (hasUpdates) {
          onScenesUpdate(updatedScenes);
          // Also update scene statuses to reflect completed state
          updatedScenes.forEach((s) => {
            if (s.videoUrl) {
              updateSceneStatus(s.scene_number, {
                status: 'completed',
                progress: 100,
                videoUrl: s.videoUrl,
              });
            }
          });
        }
      })
      .catch((error) => {
        console.error('[YouTubeRenderQueue] Failed to list existing videos:', error);
        // Don't show error to user - this is just for restoring state
      });
  }, []); // Only run on mount

  // Periodic check to rescue videos that were generated but not detected by polling
  useEffect(() => {
    const hasRunningScenes = Object.values(sceneStatuses).some((status) => status.status === 'running');
    if (!hasRunningScenes || scenes.length === 0) return;

    const rescueInterval = setInterval(async () => {
      // Check for videos every 2 minutes while rendering is active
      try {
        const videoList = await youtubeApi.listVideos();
        
        const videoMap = new Map<number, string>();
        videoList.videos.forEach((video: any) => {
          const sceneNum = video.scene_number;
          if (sceneNum !== null && sceneNum !== undefined) {
            if (!videoMap.has(sceneNum)) {
              videoMap.set(sceneNum, video.video_url);
            }
          }
        });

        // Update jobs for scenes that have videos but no videoUrl set
        scenes.forEach((scene) => {
          const videoUrl = videoMap.get(scene.scene_number);
          const status = sceneStatuses[scene.scene_number];
          
          if (videoUrl) {
            if (!scene.videoUrl) {
              const updatedScenes = scenes.map((s) =>
                s.scene_number === scene.scene_number ? { ...s, videoUrl } : s
              );
              onScenesUpdate(updatedScenes);
              
              updateSceneStatus(scene.scene_number, {
                status: 'completed',
                progress: 100,
                videoUrl,
              });
              
              // If this scene was polling, stop polling
              if (status?.taskId) {
                clearPolling(status.taskId);
              }
            }
          }
        });
      } catch (error) {
        console.error('[YouTubeRenderQueue] Failed to rescue videos:', error);
      }
    }, 120000); // Check every 2 minutes

    return () => clearInterval(rescueInterval);
  }, [sceneStatuses, scenes, onScenesUpdate, updateSceneStatus, clearPolling]);

  const runSceneVideo = useCallback(
    async (scene: Scene) => {
      if (!videoPlan) {
        onError?.('Video plan is missing');
        return;
      }
      const sn = scene.scene_number;
      const existing = sceneStatuses[sn];
      if (existing?.status === 'running') return;

      updateSceneStatus(sn, { status: 'running', progress: 5, error: undefined });

      const payload: SceneVideoRenderRequest = {
        scene,
        video_plan: videoPlan,
        resolution,
        generate_audio_enabled: false,
        voice_id: 'Wise_Woman',
      };

      try {
        const resp = await youtubeApi.generateSceneVideo(payload);
        if (resp.success && resp.task_id) {
          updateSceneStatus(sn, { status: 'running', progress: 5, taskId: resp.task_id });
          pollTask(resp.task_id, sn);
        } else {
          const msg = resp.message || 'Failed to start scene render';
          updateSceneStatus(sn, { status: 'failed', progress: 0, error: msg });
          onError?.(msg);
        }
      } catch (err: any) {
        const msg = err?.message || 'Failed to start scene render';
        updateSceneStatus(sn, { status: 'failed', progress: 0, error: msg });
        onError?.(msg);
      }
    },
    [pollTask, resolution, sceneStatuses, updateSceneStatus, videoPlan, onError]
  );

  const combineVideos = useCallback(async () => {
    const readyVideos = scenes
      .filter((s) => s.enabled !== false && s.videoUrl)
      .map((s) => s.videoUrl as string);

    if (readyVideos.length < 2) {
      onError?.('Need at least two scene videos to combine.');
      return;
    }

    setCombining(true);
    setCombiningProgress(5);
    setCombiningMessage('Starting combination...');

    try {
      const resp = await youtubeApi.combineVideos({
        scene_video_urls: readyVideos,
        video_plan: videoPlan || undefined,
        resolution,
      });

      if (!resp.success || !resp.task_id) {
        const msg = resp.message || 'Failed to start video combine';
        setCombining(false);
        setCombiningProgress(0);
        setCombiningMessage(msg);
        onError?.(msg);
        return;
      }

      const taskId = resp.task_id;
      let done = false;
      let pollCount = 0;
      const maxPolls = 300; // 10 minutes max (300 * 3 seconds) - encoding can take time
      let consecutiveNulls = 0;
      
      while (!done && pollCount < maxPolls) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        pollCount++;
        
        try {
          const status: TaskStatus | null = await youtubeApi.getRenderStatus(taskId);
          
          if (!status) {
            consecutiveNulls++;
            // Don't fail immediately - task might still be initializing
            if (consecutiveNulls < 10) {
              continue; // Wait up to 30 seconds for task to appear
            }
            throw new Error('Task not found. Video combination may have failed on the server. Please try again.');
          }
          
          // Reset null counter on successful poll
          consecutiveNulls = 0;
          
          const progress = status.progress ?? 0;
          const message = status.message || 'Combining...';
          setCombiningProgress(progress);
          setCombiningMessage(message);

          if (status.status === 'completed') {
            const url = status.result?.video_url || status.result?.final_video_url;
            if (!url) {
              throw new Error('Final video URL not found in result. Please contact support.');
            }
            setFinalVideoUrl(url);
            setCombining(false);
            setCombiningProgress(100);
            setCombiningMessage('Combined successfully');
            onSuccess?.('Final video combined successfully');
            done = true;
          } else if (status.status === 'failed') {
            const msg = status.error || status.message || 'Combine failed';
            setCombining(false);
            setCombiningProgress(0);
            setCombiningMessage(msg);
            onError?.(msg);
            done = true;
          }
        } catch (err: any) {
          const errorMsg = err?.message || 'Failed to poll combine status';
          setCombining(false);
          setCombiningProgress(0);
          setCombiningMessage(errorMsg);
          onError?.(errorMsg);
          done = true;
        }
      }
      
      if (pollCount >= maxPolls) {
        const timeoutMsg = 'Video combination timed out after 10 minutes. The video may still be processing. Please check back in a few minutes or try again.';
        setCombining(false);
        setCombiningProgress(0);
        setCombiningMessage(timeoutMsg);
        onError?.(timeoutMsg);
      }
    } catch (err: any) {
      const msg = err?.message || 'Combine failed';
      setCombining(false);
      setCombiningMessage(msg);
      onError?.(msg);
    }
  }, [onError, resolution, scenes, videoPlan]);

  return {
    sceneStatuses,
    finalVideoUrl,
    combining,
    combiningProgress,
    combiningMessage,
    runSceneVideo,
    combineVideos,
  };
}

