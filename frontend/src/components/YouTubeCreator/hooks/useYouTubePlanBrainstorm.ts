/**
 * YouTube Plan brainstorm hook — LinkedIn usePlanWedgeBrainstorm pattern,
 * YouTube API params only (platform=youtube, Channel Bible context, tags=youtube).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, aiApiClient } from "../../../api/client";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import {
  buildChannelBibleContext,
  hasChannelBibleIdentity,
} from "../utils/channelBibleContext";

export interface YouTubeBrainstormIdea {
  prompt: string;
  rationale?: string;
  evidence?: string;
  source_index?: number;
}

export interface YouTubeBrainstormSource {
  title: string;
  url: string;
  snippet: string;
}

export interface YouTubeSavedBrainstormIdea {
  id: string;
  prompt: string;
  rationale?: string | null;
  tags?: string;
  source_seed?: string | null;
}

export type YouTubeBrainstormPhase = "idle" | "loading" | "results";

interface BrainstormCacheData {
  ideas: YouTubeBrainstormIdea[];
  sources: YouTubeBrainstormSource[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_PREFIX = "youtube_brainstorm_ideas_v1_";

function isCacheData(data: unknown): data is BrainstormCacheData {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as BrainstormCacheData).ideas) &&
      typeof (data as BrainstormCacheData).timestamp === "number",
  );
}

function extractApiError(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    response?: { status?: number; data?: { detail?: unknown; message?: string } };
  };
  if (err?.response?.status === 401) {
    return "Please sign in again.";
  }
  if (err?.response?.status === 404) {
    return "Brainstorm service is unavailable. Restart the backend so /api/brainstorm routes are loaded.";
  }
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim()) {
    return err.response.data.message;
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

function tagsIncludeYoutube(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .includes("youtube");
}

interface UseYouTubePlanBrainstormParams {
  channelBible: YouTubeChannelBible | null;
  /** When true, include Channel Bible context in /ideas requests. */
  useChannelBible: boolean;
}

export function useYouTubePlanBrainstorm({
  channelBible,
  useChannelBible,
}: UseYouTubePlanBrainstormParams) {
  const [phase, setPhase] = useState<YouTubeBrainstormPhase>("idle");
  const [ideas, setIdeas] = useState<YouTubeBrainstormIdea[]>([]);
  const [sources, setSources] = useState<YouTubeBrainstormSource[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedPromptHashes, setSavedPromptHashes] = useState<Set<string>>(new Set());
  const [savedIdeas, setSavedIdeas] = useState<YouTubeSavedBrainstormIdea[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedListError, setSavedListError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const lastSeedRef = useRef("");
  const isRunningRef = useRef(false);

  const hashPrompt = useCallback((prompt: string) => {
    let hash = 0;
    const text = prompt.trim().toLowerCase();
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }, []);

  const getCacheKey = useCallback((seed: string, hasBible: boolean) => {
    return `${CACHE_PREFIX}${seed.trim().toLowerCase()}_bible=${hasBible ? "1" : "0"}`;
  }, []);

  const getCachedIdeas = useCallback((cacheKey: string): BrainstormCacheData | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isCacheData(parsed)) return null;
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const setCachedIdeas = useCallback(
    (cacheKey: string, nextIdeas: YouTubeBrainstormIdea[], nextSources: YouTubeBrainstormSource[]) => {
      try {
        const payload: BrainstormCacheData = {
          ideas: nextIdeas,
          sources: nextSources,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (err) {
        console.warn("[YouTubeBrainstorm] Failed to cache ideas:", err);
      }
    },
    [],
  );

  const resolveEffectiveSeed = useCallback(
    (panelSeed: string): string => {
      const trimmed = panelSeed.trim();
      if (trimmed) return trimmed;
      return (channelBible?.niche || "").trim();
    },
    [channelBible?.niche],
  );

  const run = useCallback(
    async (panelSeed: string, forceRefresh = false) => {
      if (isRunningRef.current) return;
      const seed = resolveEffectiveSeed(panelSeed);
      if (!seed) {
        setSeedError("Enter a topic or save a Channel Bible niche");
        setPhase("idle");
        console.info("[YouTubeBrainstorm] Skipped generate: empty seed and empty niche");
        return;
      }

      isRunningRef.current = true;
      lastSeedRef.current = seed;
      setSeedError(null);
      setSaveError(null);
      setPhase("loading");

      const includeBible = useChannelBible && hasChannelBibleIdentity(channelBible);
      const channelBibleContext = includeBible ? buildChannelBibleContext(channelBible) : "";
      const cacheKey = getCacheKey(seed, Boolean(channelBibleContext));

      console.info(
        `[YouTubeBrainstorm] Generating ideas seed_preview=${seed.slice(0, 50)} ` +
          `has_channel_bible=${Boolean(channelBibleContext)}`,
      );

      if (!forceRefresh) {
        const cached = getCachedIdeas(cacheKey);
        if (cached) {
          setIdeas(cached.ideas);
          setSources(cached.sources || []);
          setIsUsingCache(true);
          setPhase("results");
          isRunningRef.current = false;
          return;
        }
      }

      setIsUsingCache(false);

      try {
        const response = await aiApiClient.post("/api/brainstorm/ideas", {
          seed,
          count: 5,
          platform: "youtube",
          channel_bible_context: channelBibleContext || undefined,
        });
        const list = Array.isArray(response.data?.ideas) ? response.data.ideas : [];
        const srcList = Array.isArray(response.data?.sources) ? response.data.sources : [];
        setIdeas(list);
        setSources(srcList);
        if (list.length > 0) {
          setCachedIdeas(cacheKey, list, srcList);
        }
        console.info(`[YouTubeBrainstorm] Generated ${list.length} idea(s)`);
      } catch (error: unknown) {
        const message = extractApiError(error, "Failed to generate video ideas");
        setSeedError(message);
        console.error("[YouTubeBrainstorm] Generate failed:", message);
        // Keep last good cards on soft failure (do not clear ideas)
      } finally {
        setPhase("results");
        isRunningRef.current = false;
      }
    },
    [
      channelBible,
      getCacheKey,
      getCachedIdeas,
      resolveEffectiveSeed,
      setCachedIdeas,
      useChannelBible,
    ],
  );

  const save = useCallback(
    async (idx: number) => {
      const idea = ideas[idx];
      if (!idea) return;
      const prompt = idea.prompt?.trim() || "";
      if (!prompt) return;
      const hash = hashPrompt(prompt);
      if (savedPromptHashes.has(hash)) return;

      setSavingIndex(idx);
      setSaveError(null);
      try {
        await apiClient.post("/api/brainstorm/saved-ideas", {
          prompt,
          rationale: idea.rationale || "",
          source_seed: lastSeedRef.current || undefined,
          tags: "youtube",
        });
        setSavedPromptHashes((prev) => {
          const next = new Set(prev);
          next.add(hash);
          return next;
        });
        console.info("[YouTubeBrainstorm] Saved idea with tags=youtube");
      } catch (error: unknown) {
        const message = extractApiError(error, "Failed to save idea");
        setSaveError(message);
        console.error("[YouTubeBrainstorm] Save failed:", message);
      } finally {
        setSavingIndex(null);
      }
    },
    [hashPrompt, ideas, savedPromptHashes],
  );

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedListError(null);
    try {
      const response = await apiClient.get("/api/brainstorm/saved-ideas", {
        params: { limit: 100 },
      });
      const all = Array.isArray(response.data?.ideas) ? response.data.ideas : [];
      const youtubeOnly = all.filter((item: YouTubeSavedBrainstormIdea) =>
        tagsIncludeYoutube(item.tags),
      );
      setSavedIdeas(youtubeOnly);
      setSavedPromptHashes(
        new Set(youtubeOnly.map((item: YouTubeSavedBrainstormIdea) => hashPrompt(item.prompt || ""))),
      );
      console.info(`[YouTubeBrainstorm] Loaded ${youtubeOnly.length} saved YouTube idea(s)`);
    } catch (error: unknown) {
      const message = extractApiError(error, "Failed to load saved video ideas");
      setSavedListError(message);
      console.error("[YouTubeBrainstorm] loadSaved failed:", message);
    } finally {
      setSavedLoading(false);
    }
  }, [hashPrompt]);

  const resetResults = useCallback(() => {
    setPhase("idle");
    setIdeas([]);
    setSources([]);
    setSeedError(null);
    setIsUsingCache(false);
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
    };
  }, []);

  return {
    phase,
    ideas,
    sources,
    seedError,
    saveError,
    savingIndex,
    savedPromptHashes,
    savedIdeas,
    savedLoading,
    savedListError,
    isUsingCache,
    run,
    save,
    loadSaved,
    resetResults,
    resolveEffectiveSeed,
    hashPrompt,
  };
}
