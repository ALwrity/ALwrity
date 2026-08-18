import { useState, useEffect, useCallback, useRef } from 'react';
import { youtubeApi } from '../services/youtubeApi';

interface YouTubeChannel {
  token_id: number;
  channel_id: string;
  channel_name: string;
  expires_at: string;
  connected_at: string;
  is_active: boolean;
  analytics_ready?: boolean;
  needs_reconnect_for_analytics?: boolean;
}

interface YouTubePublishState {
  publishing: boolean;
  taskId: string | null;
  videoUrl: string | null;
  videoId: string | null;
  progress: string;
  error: string | null;
}

interface YouTubeStatus {
  connected: boolean;
  channels: YouTubeChannel[];
  loading: boolean;
  error: string | null;
}

export function useYouTubePublish() {
  const [status, setStatus] = useState<YouTubeStatus>({
    connected: false,
    channels: [],
    loading: false,
    error: null,
  });
  const [publishState, setPublishState] = useState<YouTubePublishState>({
    publishing: false,
    taskId: null,
    videoUrl: null,
    videoId: null,
    progress: '',
    error: null,
  });
  const popupRef = useRef<Window | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const publishPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (publishPollRef.current) clearInterval(publishPollRef.current);
    };
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));
      const result = await youtubeApi.getYouTubeStatus();
      if (result.success) {
        setStatus({
          connected: result.connected,
          channels: result.channels || [],
          loading: false,
          error: null,
        });
      } else {
        setStatus({ connected: false, channels: [], loading: false, error: 'Failed to check status' });
      }
    } catch (e: any) {
      setStatus({ connected: false, channels: [], loading: false, error: e?.message || 'Status check failed' });
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      const data = await youtubeApi.getYouTubeAuthUrl();
      if (!data.auth_url) {
        throw new Error('Failed to get authorization URL');
      }

      // Open popup
      const w = 600;
      const h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(
        data.auth_url,
        'youtube-auth',
        `width=${w},height=${h},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      popupRef.current = popup;

      // Wait for postMessage from the backend callback HTML
      const result = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          resolve({ success: false, error: 'Authorization timed out' });
        }, 180000); // 3 minute timeout

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'YOUTUBE_OAUTH_SUCCESS') {
            cleanup();
            resolve({ success: true });
          }
          if (event.data?.type === 'YOUTUBE_OAUTH_ERROR') {
            cleanup();
            resolve({ success: false, error: event.data?.error || 'Authorization failed' });
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          if (pollingRef.current) clearInterval(pollingRef.current);
        };

        window.addEventListener('message', handleMessage);

        // Fallback: poll popup closed, then check status via API
        pollingRef.current = setInterval(() => {
          if (popupRef.current?.closed) {
            cleanup();
            // Check status via API as fallback
            checkStatus().then(() => {
              setStatus((prev) => ({ ...prev, loading: false }));
            });
            resolve({ success: false, error: 'Popup closed without authorization' });
          }
        }, 1000);
      });

      if (result.success) {
        await checkStatus();
      } else {
        setStatus((prev) => ({ ...prev, loading: false, error: result.error || 'Connection failed' }));
      }
    } catch (e: any) {
      setStatus((prev) => ({ ...prev, loading: false, error: e?.message || 'Connection failed' }));
    }
  }, [checkStatus]);

  const disconnect = useCallback(async (tokenId: number) => {
    try {
      await youtubeApi.disconnectYouTube(tokenId);
      await checkStatus();
    } catch (e: any) {
      setStatus((prev) => ({ ...prev, error: e?.message || 'Disconnect failed' }));
    }
  }, [checkStatus]);

  const publishToYouTube = useCallback(async (
    videoSource: string,
    title: string,
    options?: {
      description?: string;
      tags?: string[];
      privacy_status?: string;
      category_id?: string;
      made_for_kids?: boolean;
      publish_at?: string;
    }
  ) => {
    const channel = status.channels.find((c) => c.is_active);
    if (!channel) {
      setPublishState((prev) => ({ ...prev, error: 'No active YouTube channel connected. Please connect first.' }));
      return;
    }

    try {
      setPublishState({
        publishing: true,
        taskId: null,
        videoUrl: null,
        videoId: null,
        progress: 'Starting publish...',
        error: null,
      });

      const result = await youtubeApi.startPublish({
        token_id: channel.token_id,
        video_source: videoSource,
        title,
        description: options?.description || '',
        tags: options?.tags || [],
        privacy_status: options?.privacy_status || 'unlisted',
        category_id: options?.category_id || '22',
        made_for_kids: options?.made_for_kids || false,
        publish_at: options?.publish_at,
      });

      const taskId = result.task_id;
      if (!result.success || !taskId) {
        setPublishState((prev) => ({ ...prev, publishing: false, error: result.error || 'Failed to start publish' }));
        return;
      }

      setPublishState((prev) => ({
        ...prev,
        taskId,
        progress: 'Uploading to YouTube...',
      }));

      // Start polling for status
      if (publishPollRef.current) clearInterval(publishPollRef.current);
      publishPollRef.current = setInterval(async () => {
        try {
          const pollResult = await youtubeApi.getPublishStatus(taskId);
          if (pollResult.success && pollResult.video_url) {
            if (publishPollRef.current) clearInterval(publishPollRef.current);
            setPublishState({
              publishing: false,
              taskId,
              videoUrl: pollResult.video_url,
              videoId: pollResult.video_id || null,
              progress: 'Published!',
              error: null,
            });
          } else if (!pollResult.success && pollResult.error) {
            if (publishPollRef.current) clearInterval(publishPollRef.current);
            setPublishState({
              publishing: false,
              taskId,
              videoUrl: null,
              videoId: null,
              progress: '',
              error: pollResult.error,
            });
          } else {
            setPublishState((prev) => ({
              ...prev,
              progress: pollResult.message || 'Uploading to YouTube...',
            }));
          }
        } catch (e: any) {
          // Don't stop polling on transient errors
          console.warn('Publish poll error:', e?.message);
        }
      }, 3000);
    } catch (e: any) {
      setPublishState({
        publishing: false,
        taskId: null,
        videoUrl: null,
        videoId: null,
        progress: '',
        error: e?.message || 'Publish failed',
      });
    }
  }, [status.channels]);

  const resetPublishState = useCallback(() => {
    if (publishPollRef.current) clearInterval(publishPollRef.current);
    setPublishState({
      publishing: false,
      taskId: null,
      videoUrl: null,
      videoId: null,
      progress: '',
      error: null,
    });
  }, []);

  const activeChannel = status.channels.find((c) => c.is_active) || null;

  return {
    ...status,
    activeChannel,
    connect,
    disconnect,
    checkStatus,
    publishState,
    publishToYouTube,
    resetPublishState,
  };
}
