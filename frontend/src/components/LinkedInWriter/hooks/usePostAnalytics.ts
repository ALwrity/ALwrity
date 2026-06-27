import { useCallback, useRef, useState } from 'react';
import {
  postAnalyticsApi,
  type FetchPostsParams,
  type PostListResponse,
} from '../../../services/postAnalyticsApi';

export type PostAnalyticsPanelState = 'idle' | 'loading' | 'loaded' | 'error';

function extractErrorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'Failed to load LinkedIn posts';
}

export function usePostAnalytics() {
  const [data, setData] = useState<PostListResponse | null>(null);
  const [panelState, setPanelState] = useState<PostAnalyticsPanelState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inFlightRef = useRef(false);

  const fetchPosts = useCallback(async (params?: FetchPostsParams) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setPanelState('loading');
    setErrorMessage('');

    try {
      const result = await postAnalyticsApi.fetchPosts(params);
      setData(result);
      setPanelState('loaded');
    } catch (err: unknown) {
      console.error('[PostAnalytics] Failed to fetch posts:', err);
      setErrorMessage(extractErrorMessage(err));
      setPanelState('error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  return {
    data,
    panelState,
    errorMessage,
    fetchPosts,
  };
}
