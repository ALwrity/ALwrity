/**
 * Fetch analytics for Performance Pulse modal.
 */
import { useCallback, useEffect, useState } from "react";
import { postAnalyticsApi, type LinkedInPost } from "../../../../../services/postAnalyticsApi";

export interface UsePerformancePulseDataResult {
  posts: LinkedInPost[];
  loading: boolean;
  error: string;
  loadedAt: number | null;
  fetchPosts: (refresh?: boolean) => Promise<void>;
  resetForOpen: () => void;
}

export function usePerformancePulseData(open: boolean): UsePerformancePulseDataResult {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const fetchPosts = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const res = await postAnalyticsApi.fetchStoredAnalytics(refresh);
      const fetched = res.posts ?? [];
      setPosts(fetched);
      if (fetched.length > 0) setLoadedAt(Date.now());
    } catch {
      setError("Could not load your posts. Make sure LinkedIn is connected.");
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForOpen = useCallback(() => {
    setError("");
    setPosts([]);
    setLoadedAt(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForOpen();
    void fetchPosts(false);
  }, [open, fetchPosts, resetForOpen]);

  return {
    posts,
    loading,
    error,
    loadedAt,
    fetchPosts,
    resetForOpen,
  };
}
