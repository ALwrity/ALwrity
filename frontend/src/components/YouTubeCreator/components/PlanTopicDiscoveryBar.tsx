/**
 * Topic discovery chips + Trends for YouTube Plan Your Video.
 * Reuses Podcast trends/category APIs and modals. Does not invent topic lists.
 */

import React, { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SchoolIcon from "@mui/icons-material/School";
import PublicIcon from "@mui/icons-material/Public";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { TrendingTopicsModal } from "../../PodcastMaker/CreateStep/TrendingTopicsModal";
import { CategoryResearchModal } from "../../PodcastMaker/CreateStep/CategoryResearchModal";
import { podcastApi } from "../../../services/podcastApi";

type CategoryType = "news" | "finance" | "research-paper" | "personal-site";

interface CategoryTopic {
  title: string;
  url: string;
  snippet: string;
  score: number;
  favicon?: string;
}

interface PlanTopicDiscoveryBarProps {
  userIdea: string;
  onIdeaChange: (idea: string) => void;
  disabled?: boolean;
}

type CategoryChipIcon = typeof NewspaperIcon;

const CATEGORY_CHIPS: Array<{
  category: CategoryType;
  label: string;
  Icon: CategoryChipIcon;
  color: string;
}> = [
  { category: "news", label: "News", Icon: NewspaperIcon, color: "#667eea" },
  { category: "finance", label: "Finance", Icon: ShowChartIcon, color: "#10b981" },
  { category: "research-paper", label: "Research Papers", Icon: SchoolIcon, color: "#8b5cf6" },
  { category: "personal-site", label: "Personal Site", Icon: PublicIcon, color: "#f59e0b" },
];

/** YouTube Trends temporarily disabled until Google Trends integration is production-ready. */
const YOUTUBE_TRENDS_COMING_SOON = true;

function ideaPreview(idea: string): string {
  return idea.trim().slice(0, 50);
}

function looksLikeWebsiteUrl(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.includes("://") ||
    (text.includes(".") && !text.includes(" "))
  );
}

function extractApiError(error: unknown, fallback: string): string {
  const err = error as {
    message?: string;
    response?: {
      status?: number;
      data?: { detail?: unknown; message?: string; error?: string };
    };
  };
  const status = err?.response?.status;
  const data = err?.response?.data;
  const detail = data?.detail;

  if (status === 401) {
    return "Please sign in again.";
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (detail && typeof detail === "object") {
    const typed = detail as { message?: string; error?: string };
    if (typeof typed.message === "string" && typed.message.trim()) {
      return typed.message.trim();
    }
    if (typeof typed.error === "string" && typed.error.trim()) {
      return typed.error.trim();
    }
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  if (status === 429) {
    return fallback;
  }
  if (status === 503) {
    return "Trends is temporarily unavailable.";
  }

  return typeof err?.message === "string" && err.message.trim() ? err.message.trim() : fallback;
}

export const PlanTopicDiscoveryBar: React.FC<PlanTopicDiscoveryBarProps> = ({
  userIdea,
  onIdeaChange,
  disabled = false,
}) => {
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("news");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryTopics, setCategoryTopics] = useState<CategoryTopic[]>([]);
  const [lastSearchedTopic, setLastSearchedTopic] = useState("");
  const [lastSearchedCategory, setLastSearchedCategory] = useState<CategoryType | "">("");

  const hasIdea = userIdea.trim().length > 0;
  const controlsDisabled = !hasIdea || disabled || categoryLoading;

  const handleCategoryResearch = useCallback(
    async (
      category: CategoryType,
      forceRefresh: boolean = false,
      overrideKeyword?: string,
      websiteUrlOverride?: string
    ) => {
      const currentTopic = (overrideKeyword || userIdea).trim();
      const canUseCache =
        !forceRefresh &&
        !overrideKeyword &&
        currentTopic === lastSearchedTopic &&
        category === lastSearchedCategory &&
        categoryTopics.length > 0;

      setSelectedCategory(category);
      setCategoryOpen(true);

      if (canUseCache) {
        console.info("[YouTubePlanDiscovery] Using cached category results", {
          category,
          topicCount: categoryTopics.length,
        });
        setCategoryLoading(false);
        return;
      }

      setCategoryLoading(true);
      setCategoryError(null);
      setCategoryTopics([]);

      let websiteUrl: string | undefined;
      if (category === "personal-site") {
        const candidate = (websiteUrlOverride || userIdea).trim();
        if (looksLikeWebsiteUrl(candidate)) {
          websiteUrl = candidate;
        }
      }

      console.info("[YouTubePlanDiscovery] Category search started", {
        category,
        ideaLength: currentTopic.length,
        ideaPreview: ideaPreview(currentTopic),
        hasWebsiteUrl: Boolean(websiteUrl),
      });

      try {
        const result = await podcastApi.researchByCategory({
          category,
          keyword: currentTopic || undefined,
          maxResults: 8,
          websiteUrl,
        });

        if (result.success) {
          const topics = result.topics || [];
          setCategoryTopics(topics);
          setLastSearchedTopic(currentTopic);
          setLastSearchedCategory(category);
          if (topics.length === 0) {
            console.warn("[YouTubePlanDiscovery] Category search returned no topics", {
              category,
              provider: result.provider,
            });
          } else {
            console.info("[YouTubePlanDiscovery] Category search succeeded", {
              category,
              topicCount: topics.length,
              provider: result.provider,
            });
          }
        } else {
          const message = result.error || `Failed to fetch ${category} topics`;
          console.error("[YouTubePlanDiscovery] Category search success=false", {
            category,
            error: message,
          });
          setCategoryError(message);
        }
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        const message = extractApiError(error, "Could not load topics. Please try again.");
        console.error("[YouTubePlanDiscovery] Category search failed", {
          category,
          status,
          message,
        });
        setCategoryError(message);
      } finally {
        setCategoryLoading(false);
      }
    },
    [userIdea, lastSearchedTopic, lastSearchedCategory, categoryTopics.length]
  );

  const handleFillIdea = (topic: string, source: "trends" | "category") => {
    const trimmed = topic.trim();
    if (!trimmed) {
      console.warn("[YouTubePlanDiscovery] Ignored empty topic selection", { source });
      return;
    }
    console.info("[YouTubePlanDiscovery] Topic selected", {
      source,
      titleLength: trimmed.length,
    });
    onIdeaChange(trimmed);
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1 }}>
        Discover topics from web research categories below. Google Trends is coming soon.
      </Typography>

      {!hasIdea && (
        <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mb: 1 }}>
          Type a video idea first, then search categories below.
        </Typography>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {CATEGORY_CHIPS.map((chip) => {
          const ChipIcon = chip.Icon;
          const chipIcon =
            categoryLoading && selectedCategory === chip.category ? (
              <CircularProgress size={14} sx={{ color: `${chip.color} !important` }} />
            ) : (
              <ChipIcon sx={{ fontSize: "0.875rem !important" }} />
            );

          return (
          <Chip
            key={chip.category}
            icon={chipIcon}
            label={chip.label}
            onClick={() => {
              if (controlsDisabled) return;
              void handleCategoryResearch(chip.category);
            }}
            disabled={controlsDisabled}
            size="small"
            sx={{
              background: `${chip.color}1a`,
              color: chip.color,
              border: `1px solid ${chip.color}4d`,
              fontWeight: 600,
              fontSize: "0.8125rem",
              "&:hover": { background: `${chip.color}33` },
            }}
          />
          );
        })}
      </Stack>

      <Button
        size="small"
        variant="contained"
        startIcon={YOUTUBE_TRENDS_COMING_SOON ? <LockOutlinedIcon /> : <TrendingUpIcon />}
        onClick={() => {
          if (YOUTUBE_TRENDS_COMING_SOON || controlsDisabled) return;
          console.info("[YouTubePlanDiscovery] Opening trends", {
            ideaLength: userIdea.trim().length,
            ideaPreview: ideaPreview(userIdea),
          });
          setTrendingOpen(true);
        }}
        disabled={YOUTUBE_TRENDS_COMING_SOON || controlsDisabled}
        sx={{
          textTransform: "none",
          fontSize: "0.875rem",
          fontWeight: 600,
          borderRadius: 2.5,
          color: "#f8fbff",
          px: 2,
          py: 0.75,
          border: YOUTUBE_TRENDS_COMING_SOON
            ? "1px solid rgba(100, 116, 139, 0.4)"
            : "1px solid rgba(16, 185, 129, 0.4)",
          background: YOUTUBE_TRENDS_COMING_SOON
            ? "linear-gradient(120deg, #94a3b8 0%, #64748b 100%)"
            : "linear-gradient(120deg, #10b981 0%, #059669 55%, #047857 100%)",
          "&:hover": {
            background: YOUTUBE_TRENDS_COMING_SOON
              ? "linear-gradient(120deg, #94a3b8 0%, #64748b 100%)"
              : "linear-gradient(120deg, #34d399 0%, #10b981 50%, #059669 100%)",
          },
        }}
      >
        {YOUTUBE_TRENDS_COMING_SOON ? "Get Trending Topics — Coming Soon" : "Get Trending Topics"}
      </Button>

      {categoryError && !categoryOpen && (
        <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>
          {categoryError}
        </Alert>
      )}

      <TrendingTopicsModal
        open={trendingOpen}
        onClose={() => setTrendingOpen(false)}
        onSelectTopic={(topic) => handleFillIdea(topic, "trends")}
        initialKeywords={userIdea}
        source="podcast"
      />

      <CategoryResearchModal
        open={categoryOpen}
        onClose={() => {
          setCategoryOpen(false);
          setCategoryError(null);
        }}
        category={selectedCategory}
        keyword={userIdea}
        websiteUrl={selectedCategory === "personal-site" ? userIdea : undefined}
        loading={categoryLoading}
        topics={categoryTopics}
        error={categoryError}
        productNoun="video"
        onSelectTopic={(topic) => {
          handleFillIdea(topic, "category");
          setCategoryOpen(false);
        }}
        onRedoSearch={(keyword, websiteUrl) => {
          void handleCategoryResearch(selectedCategory, true, keyword, websiteUrl);
        }}
        onConfirmSelection={(selectedTopics) => {
          if (selectedTopics.length > 0) {
            handleFillIdea(selectedTopics[0], "category");
          }
          setCategoryOpen(false);
        }}
      />
    </Box>
  );
};
