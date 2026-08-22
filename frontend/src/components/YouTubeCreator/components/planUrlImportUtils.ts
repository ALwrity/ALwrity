import { apiClient } from "../../../api/client";

export interface YouTubeSourceArticle {
  url: string;
  title: string;
  summary: string;
}

export function extractApiError(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: { detail?: unknown; message?: string; error?: string } };
  };
  const status = err?.response?.status;
  const data = err?.response?.data;
  const detail = data?.detail;

  if (status === 401) return "Please sign in again.";
  if (status === 404) {
    return "URL extract is unavailable. Restart the backend or enable topic discovery routes.";
  }
  if (status === 503) return "Content extraction is temporarily unavailable. Try again shortly.";
  if (status === 504) return "Extraction timed out. Try a shorter article or try again.";
  if (!status && err?.code === "ECONNABORTED") {
    return "Extraction timed out. Try again or use a different URL.";
  }
  if (!status && err?.message?.toLowerCase().includes("network")) {
    return "Network error. Check your connection and try again.";
  }
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (detail && typeof detail === "object") {
    const typed = detail as { message?: string; error?: string };
    if (typed.message?.trim()) return typed.message.trim();
    if (typed.error?.trim()) return typed.error.trim();
  }
  if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
  return typeof err?.message === "string" && err.message.trim() ? err.message.trim() : fallback;
}

export function buildIdeaFromExtraction(data: {
  title?: string;
  summary?: string;
  text?: string;
}): string {
  const summary = (data.summary || "").trim();
  const title = (data.title || "").trim();
  const text = (data.text || "").trim();
  if (title && summary) return `${title}: ${summary}`;
  if (summary) return summary;
  if (title) return title;
  if (text) return text.slice(0, 500);
  return "";
}

/** Persist a URL-extracted idea to the shared brainstorm saved-ideas library (YouTube tag). */
export async function saveExtractedIdeaToBrainstorm(
  idea: string,
  article: YouTubeSourceArticle,
): Promise<void> {
  const prompt = idea.trim();
  if (!prompt) {
    throw new Error("Idea is empty");
  }

  const rationale = (article.summary || article.title || "").trim();
  const sourceSeed = article.url.trim() || undefined;

  await apiClient.post("/api/brainstorm/saved-ideas", {
    prompt,
    rationale,
    source_seed: sourceSeed,
    tags: "youtube",
  });
}
