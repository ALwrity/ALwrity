/* @refresh reset */
/**
 * Import a blog/article URL into YouTube Plan Your Video.
 * Reuses Podcast extract + WebsitePreviewModal. Does not invent article text.
 */

import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import { WebsitePreviewModal } from "../../PodcastMaker/CreateStep/WebsitePreviewModal";
import { podcastApi } from "../../../services/podcastApi";
import { inputSx } from "../styles";
import {
  buildIdeaFromExtraction,
  extractApiError,
  type YouTubeSourceArticle,
} from "./planUrlImportUtils";
import YouTubeUrlExtractAnalysis, {
  type YouTubeExtractedPageView,
} from "./YouTubeUrlExtractAnalysis";
import YouTubeUrlPreviewActions from "./YouTubeUrlPreviewActions";

type ExtractedPage = YouTubeExtractedPageView;

interface PlanUrlImportBarProps {
  userIdea: string;
  onIdeaChange: (idea: string) => void;
  onSourceArticleChange: (article: YouTubeSourceArticle | null) => void;
  disabled?: boolean;
  /** Plan wedge / Video Creator: results below the form. Overlay kept for legacy/tests. */
  resultsPlacement?: "overlay" | "inline";
  actionBusy?: boolean;
  onInlineSave?: (idea: string, article: YouTubeSourceArticle) => void;
  onInlineBrainstorm?: (idea: string) => void;
  onInlineUse?: (idea: string, article: YouTubeSourceArticle) => void;
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function PlanUrlImportBar({
  userIdea,
  onIdeaChange,
  onSourceArticleChange,
  disabled = false,
  resultsPlacement = "overlay",
  actionBusy = false,
  onInlineSave,
  onInlineBrainstorm,
  onInlineUse,
}: PlanUrlImportBarProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedPage | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importedHost, setImportedHost] = useState<string | null>(null);

  const extractDisabled = disabled || isExtracting || !websiteUrl.trim();
  const ideaLooksLikeUrl = looksLikeHttpUrl(userIdea) && !websiteUrl.trim();

  const handleExtract = async () => {
    const url = websiteUrl.trim();
    if (!url) {
      setWebsiteError("Please enter a website URL");
      console.warn("[YouTubePlanUrl] Extract blocked: empty URL");
      return;
    }
    if (!looksLikeHttpUrl(url)) {
      setWebsiteError("Enter a full URL starting with http:// or https://");
      console.warn("[YouTubePlanUrl] Extract blocked: invalid protocol", { host: urlHost(url) });
      return;
    }

    setIsExtracting(true);
    setWebsiteError(null);
    console.info("[YouTubePlanUrl] Extract started", { host: urlHost(url), urlLength: url.length });

    try {
      const result = await podcastApi.extractUrl({ url });
      if (!result.success) {
        const message = result.error || "Could not extract this page.";
        console.warn("[YouTubePlanUrl] Extract success=false", {
          host: urlHost(url),
          error: message,
          returnedUrl: result.url || url,
        });
        setWebsiteError(message);
        return;
      }

      const title = (result.title || "").trim();
      const summary = (result.summary || "").trim();
      const text = (result.text || "").trim();
      if (!title && !summary && !text) {
        console.warn("[YouTubePlanUrl] Extract returned no readable content", {
          host: urlHost(url),
          hasHighlights: Boolean(result.highlights?.length),
        });
        setWebsiteError("No readable content found at this URL.");
        return;
      }

      const extraction: ExtractedPage = {
        title,
        text,
        summary,
        highlights: result.highlights || [],
        url: result.url || url,
        image: result.image,
        favicon: result.favicon,
        subpages: result.subpages || [],
      };
      setExtractedData(extraction);
      if (resultsPlacement === "overlay") {
        setPreviewOpen(true);
      }
      console.info("[YouTubePlanUrl] Extract succeeded", {
        host: urlHost(extraction.url),
        titleLength: title.length,
        summaryLength: summary.length,
        textLength: text.length,
        highlightCount: extraction.highlights.length,
        subpageCount: extraction.subpages?.length ?? 0,
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; code?: string; message?: string };
      const status = err?.response?.status;
      const message = extractApiError(error, "Could not extract this page. Please try again.");
      console.error("[YouTubePlanUrl] Extract failed", {
        status: status ?? "none",
        code: err?.code ?? "none",
        message,
        host: urlHost(url),
        rawMessage: err?.message ?? "unknown",
      });
      setWebsiteError(message);
    } finally {
      setIsExtracting(false);
    }
  };

  const articleFromPage = (page: ExtractedPage): YouTubeSourceArticle | null => {
    const idea = buildIdeaFromExtraction(page);
    if (!idea) return null;
    const title = page.title.trim();
    const summary = (page.summary || page.text.slice(0, 4000)).trim();
    return { url: page.url, title, summary };
  };

  const handleUseForVideoIdea = () => {
    if (!extractedData) return;
    const idea = buildIdeaFromExtraction(extractedData);
    const article = articleFromPage(extractedData);
    if (!idea || !article) {
      console.warn("[YouTubePlanUrl] Use for video idea blocked: empty extraction", {
        host: urlHost(extractedData.url),
      });
      setWebsiteError("No readable content found at this URL.");
      return;
    }
    onIdeaChange(idea);
    onSourceArticleChange(article);
    setImportedHost(urlHost(extractedData.url));
    setPreviewOpen(false);
    console.info("[YouTubePlanUrl] Filled video idea from article", {
      host: urlHost(extractedData.url),
      usedTitleAndSummary: Boolean(article.title && extractedData.summary.trim()),
      ideaLength: idea.length,
    });
  };

  const runInline = (kind: "save" | "brainstorm" | "use") => {
    if (!extractedData) return;
    const idea = buildIdeaFromExtraction(extractedData);
    const article = articleFromPage(extractedData);
    if (!idea || !article) {
      setWebsiteError("No readable content found at this URL.");
      return;
    }
    if (kind === "save") {
      onInlineSave?.(idea, article);
      return;
    }
    if (kind === "brainstorm") {
      onInlineBrainstorm?.(idea);
      return;
    }
    onInlineUse?.(idea, article);
  };

  return (
    <Box sx={{ mt: 1.5 }} data-tour="yt-url-import">
      <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1 }}>
        Have a blog or article? Paste the URL and we will turn it into a video idea.
      </Typography>

      {ideaLooksLikeUrl && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
            Your idea looks like a URL. Paste it here and click Extract.
          </Typography>
          <Button
            size="small"
            variant="text"
            disabled={disabled}
            onClick={() => setWebsiteUrl(userIdea.trim())}
            sx={{ textTransform: "none", fontSize: "0.75rem", minWidth: 0, p: 0 }}
          >
            Use idea URL
          </Button>
        </Stack>
      )}

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          size="small"
          fullWidth
          placeholder="https://example.com/your-article"
          value={websiteUrl}
          onChange={(e) => {
            setWebsiteUrl(e.target.value);
            if (websiteError) setWebsiteError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !extractDisabled) {
              e.preventDefault();
              void handleExtract();
            }
          }}
          disabled={disabled || isExtracting}
          inputProps={{ "aria-label": "Article URL to import" }}
          InputProps={{
            startAdornment: (
              <LinkIcon sx={{ color: "#6b7280", mr: 0.75, fontSize: "1.1rem" }} aria-hidden />
            ),
          }}
          sx={inputSx}
        />
        <Button
          variant="contained"
          size="small"
          onClick={() => void handleExtract()}
          disabled={extractDisabled}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            "&:hover": { background: "linear-gradient(135deg, #7c8ff0 0%, #8a5cb3 100%)" },
          }}
        >
          {isExtracting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Extract"}
        </Button>
      </Stack>

      {importedHost && (
        <Chip
          size="small"
          label={`Using article: ${importedHost}`}
          onDelete={() => {
            setImportedHost(null);
            onSourceArticleChange(null);
            console.info("[YouTubePlanUrl] Cleared source article context");
          }}
          sx={{ mt: 1, fontWeight: 600 }}
        />
      )}

      {websiteError && (
        <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
          {websiteError}
        </Alert>
      )}

      {resultsPlacement === "inline" && extractedData ? (
        <>
          <YouTubeUrlExtractAnalysis page={extractedData} />
          <YouTubeUrlPreviewActions
            saving={actionBusy}
            onCancel={() => setExtractedData(null)}
            onSave={() => runInline("save")}
            onBrainstorm={() => runInline("brainstorm")}
            onUse={() => runInline("use")}
          />
        </>
      ) : null}

      {resultsPlacement === "overlay" ? (
        <WebsitePreviewModal
          open={previewOpen}
          extractedData={extractedData}
          onClose={() => setPreviewOpen(false)}
          showAnalyzeButton={false}
          useTextLabel="Use for video idea"
          onAnalyzeContent={() => undefined}
          onUseTextOnly={handleUseForVideoIdea}
        />
      ) : null}
    </Box>
  );
}
