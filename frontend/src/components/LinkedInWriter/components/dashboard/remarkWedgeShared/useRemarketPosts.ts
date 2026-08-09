import { useCallback, useEffect, useState } from "react";
import {
  postAnalyticsApi,
  type LinkedInPost,
} from "../../../../../services/postAnalyticsApi";

const POSTS_CACHE_KEY = "rw_posts_cache";
const POSTS_CACHE_TTL = 10 * 60 * 1000;

interface PostsCache {
  posts: LinkedInPost[];
  ts: number;
}

function readPostsCache(): LinkedInPost[] | null {
  try {
    const raw = sessionStorage.getItem(POSTS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as PostsCache;
    if (Date.now() - cache.ts > POSTS_CACHE_TTL) return null;
    return cache.posts;
  } catch {
    return null;
  }
}

function writePostsCache(posts: LinkedInPost[]) {
  try {
    sessionStorage.setItem(
      POSTS_CACHE_KEY,
      JSON.stringify({ posts, ts: Date.now() }),
    );
  } catch {
    /* storage full */
  }
}

/** Loads LinkedIn posts for Remarket wedge modals (session-cached). */
export function useRemarketPosts(open: boolean, limit = 10) {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = readPostsCache();
        if (cached) {
          setPosts(cached);
          return;
        }
      }
      setLoading(true);
      setError("");
      try {
        const res = await postAnalyticsApi.fetchPosts({ limit });
        const loaded = res.posts ?? [];
        writePostsCache(loaded);
        setPosts(loaded);
      } catch {
        setError("Could not load posts. Make sure LinkedIn is connected.");
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  return { posts, loading, error, reload: () => void load(true) };
}
