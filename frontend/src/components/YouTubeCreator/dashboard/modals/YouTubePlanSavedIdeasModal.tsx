/**
 * Plan wedge drill-down — Saved Ideas (LinkedIn MySavedIdeas pattern).
 */
import React, { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../../api/client";
import { YouTubeActionModal } from "../YouTubeActionModal";
import {
  YOUTUBE_WEDGE_BACK_LABELS,
  youtubeSubModalShellProps,
} from "../youtubeWedgeModalUi";
import type { YouTubeSavedBrainstormIdea } from "../../hooks/useYouTubePlanBrainstorm";
import { YouTubePlanSavedIdeasBody } from "./YouTubePlanSavedIdeasBody";

function tagsIncludeYoutube(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .includes("youtube");
}

function extractApiError(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    response?: { data?: { detail?: unknown; message?: string } };
  };
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim()) {
    return err.response.data.message;
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export async function fetchYouTubeSavedIdeasCount(): Promise<number> {
  const response = await apiClient.get("/api/brainstorm/saved-ideas", {
    params: { limit: 100 },
  });
  const all = Array.isArray(response.data?.ideas) ? response.data.ideas : [];
  return all.filter((item: YouTubeSavedBrainstormIdea) => tagsIncludeYoutube(item.tags)).length;
}

interface YouTubePlanSavedIdeasModalProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  onUseIdea: (prompt: string) => void;
  onAfterDelete?: () => void;
}

export const YouTubePlanSavedIdeasModal: React.FC<YouTubePlanSavedIdeasModalProps> = ({
  open,
  onClose,
  onBack,
  onUseIdea,
  onAfterDelete,
}) => {
  const [ideas, setIdeas] = useState<YouTubeSavedBrainstormIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shell = youtubeSubModalShellProps("plan", onBack);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/brainstorm/saved-ideas", {
        params: { limit: 100 },
      });
      const all = Array.isArray(response.data?.ideas) ? response.data.ideas : [];
      const youtubeOnly = all.filter((item: YouTubeSavedBrainstormIdea) =>
        tagsIncludeYoutube(item.tags),
      );
      setIdeas(youtubeOnly);
      console.info(`[YouTubePlanSavedIdeas] Loaded ${youtubeOnly.length} saved idea(s)`);
    } catch (err: unknown) {
      const message = extractApiError(err, "Failed to load saved video ideas");
      setError(message);
      console.error("[YouTubePlanSavedIdeas] Load failed:", message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleCopy = useCallback(async (idea: YouTubeSavedBrainstormIdea) => {
    try {
      await navigator.clipboard.writeText(idea.prompt);
      setCopiedId(idea.id);
      window.setTimeout(
        () => setCopiedId((prev) => (prev === idea.id ? null : prev)),
        1800,
      );
    } catch (err) {
      console.error("[YouTubePlanSavedIdeas] Copy failed", err);
    }
  }, []);

  const handleDelete = useCallback(
    async (idea: YouTubeSavedBrainstormIdea) => {
      const ok = window.confirm(
        `Delete this saved idea?\n\n"${idea.prompt.slice(0, 80)}${idea.prompt.length > 80 ? "..." : ""}"`,
      );
      if (!ok) return;
      setDeletingId(idea.id);
      try {
        await apiClient.delete(
          `/api/brainstorm/saved-ideas/${encodeURIComponent(idea.id)}`,
        );
        await refresh();
        onAfterDelete?.();
        console.info("[YouTubePlanSavedIdeas] Deleted idea", { id: idea.id });
      } catch (err: unknown) {
        const message = extractApiError(err, "Failed to delete idea");
        setError(message);
        console.error("[YouTubePlanSavedIdeas] Delete failed:", message);
      } finally {
        setDeletingId(null);
      }
    },
    [onAfterDelete, refresh],
  );

  const countLabel = loading
    ? "Loading…"
    : `${ideas.length} saved idea${ideas.length === 1 ? "" : "s"}`;

  return (
    <YouTubeActionModal
      open={open}
      title="Saved Ideas"
      onClose={onClose}
      onBack={shell.onBack}
      backLabel={shell.backLabel}
      maxWidth={shell.maxWidth}
      titleSize={shell.titleSize}
      headerLayout={shell.headerLayout}
      cardClassName="yt-plan-saved-ideas-modal"
    >
      <p className="yt-plan-saved-ideas-modal__intro">
        {countLabel} — copy or open in Video Creator.
      </p>
      <YouTubePlanSavedIdeasBody
        ideas={ideas}
        loading={loading}
        error={error}
        copiedId={copiedId}
        deletingId={deletingId}
        onUseIdea={onUseIdea}
        onCopy={handleCopy}
        onDelete={handleDelete}
        formatRelative={formatRelative}
      />
    </YouTubeActionModal>
  );
};
