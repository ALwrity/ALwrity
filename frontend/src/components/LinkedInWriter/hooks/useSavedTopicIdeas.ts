import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../api/client";

const hashPrompt = (prompt: string) => prompt.trim().toLowerCase();

/** Tracks saved topic-idea prompts (shared with Plan / Quick Create saved ideas). */
export function useSavedTopicIdeas() {
  const [savedHashes, setSavedHashes] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/brainstorm/saved-ideas", {
        params: { limit: 200, offset: 0 },
      });
      if (Array.isArray(res.data?.ideas)) {
        setSavedHashes(
          new Set(
            res.data.ideas.map((it: { prompt: string }) =>
              hashPrompt(it.prompt),
            ),
          ),
        );
      }
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const saveTopicIdea = useCallback(
    async (id: string, title: string, rationale: string) => {
      const prompt = title.trim();
      if (!prompt) return false;
      const hash = hashPrompt(prompt);
      if (savedHashes.has(hash)) return true;

      setSavingId(id);
      setSaveError(null);
      try {
        await apiClient.post("/api/brainstorm/saved-ideas", {
          prompt,
          rationale: rationale || "",
          source_seed: "topic_recommendations",
        });
        setSavedHashes((prev) => {
          const next = new Set(prev);
          next.add(hash);
          return next;
        });
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } }; message?: string })
            ?.response?.data?.detail ||
          (err as Error)?.message ||
          "Failed to save topic";
        setSaveError(message);
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [savedHashes],
  );

  const isSaved = useCallback(
    (title: string) => savedHashes.has(hashPrompt(title)),
    [savedHashes],
  );

  return {
    isSaved,
    savingId,
    saveError,
    saveTopicIdea,
    refreshSaved,
  };
}
