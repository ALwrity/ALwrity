import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Checkbox,
} from "@mui/material";
import NewspaperIcon from '@mui/icons-material/Newspaper';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SchoolIcon from '@mui/icons-material/School';
import PublicIcon from '@mui/icons-material/Public';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SearchIcon from '@mui/icons-material/Search';
import LanguageIcon from '@mui/icons-material/Language';

interface CategoryTopic {
  title: string;
  url: string;
  snippet: string;
  score: number;
  favicon?: string;
}

type CategoryType = "news" | "finance" | "research-paper" | "personal-site";

interface CategoryResearchModalProps {
  open: boolean;
  onClose: () => void;
  category: CategoryType;
  keyword?: string;
  websiteUrl?: string;
  loading?: boolean;
  topics?: CategoryTopic[];
  error?: string | null;
  onSelectTopic: (topic: string) => void;
  onRedoSearch?: (keyword: string, websiteUrl?: string) => void;
  onConfirmSelection?: (selectedTopics: string[]) => void;
  isCached?: boolean;
  /** Used in loading and confirm copy. Default keeps Podcast wording. */
  productNoun?: string;
}

const CATEGORY_CONFIG: Record<CategoryType, { label: string; icon: React.ReactNode; color: string; bgLight: string }> = {
  "news": { label: "News", icon: <NewspaperIcon />, color: "#4F46E5", bgLight: "#EEF2FF" },
  "finance": { label: "Finance", icon: <ShowChartIcon />, color: "#059669", bgLight: "#ECFDF5" },
  "research-paper": { label: "Research Papers", icon: <SchoolIcon />, color: "#7C3AED", bgLight: "#F3E8FF" },
  "personal-site": { label: "Personal Website", icon: <PublicIcon />, color: "#D97706", bgLight: "#FEF3C7" },
};

const BEST_PRACTICES: Record<CategoryType, string[]> = {
  "news": [
    "Use specific, focused keywords for better results",
    "Include relevant industry or niche terms",
    "Add location or timeframe for localized news",
    "Avoid very general terms like 'news' or 'updates'",
  ],
  "finance": [
    "Use specific, focused keywords for better results",
    "Include asset class (stocks, crypto, forex, bonds)",
    "Add timeframe (q1 2024, last month, etc.)",
    "Include market or sector names for targeted results",
  ],
  "research-paper": [
    "Use academic keywords and terminology",
    "Include specific topics or research areas",
    "Add field of study (AI, medicine, climate, etc.)",
    "Works best with technical or scientific topics",
  ],
  "personal-site": [
    "Enter the website URL in the input field below",
    "The search will find content within that domain",
    "Use specific page or topic keywords for best results",
    "Leave keyword empty to get all pages from the site",
  ],
};

export const CategoryResearchModal: React.FC<CategoryResearchModalProps> = ({
  open,
  onClose,
  category,
  keyword,
  websiteUrl = "",
  loading = false,
  topics = [],
  error = null,
  onSelectTopic,
  onRedoSearch,
  onConfirmSelection,
  isCached = false,
  productNoun = "podcast",
}) => {
  const config = CATEGORY_CONFIG[category];
  const categoryLabel = config.label;
  const categoryIcon = config.icon;
  const categoryColor = config.color;
  const categoryBgLight = config.bgLight;

  const [redoKeyword, setRedoKeyword] = useState(keyword || "");
  const [localWebsiteUrl, setLocalWebsiteUrl] = useState(websiteUrl);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setRedoKeyword(keyword || "");
      setLocalWebsiteUrl(websiteUrl || "");
      setSelectedTopics(new Set());
    }
  }, [open, keyword, websiteUrl]);

  const handleSelectTopic = (topic: CategoryTopic) => {
    onSelectTopic(topic.title);
  };

  const handleClose = () => {
    onClose();
  };

  const handleRedoClick = () => {
    if (onRedoSearch && redoKeyword.trim()) {
      onRedoSearch(redoKeyword.trim(), category === "personal-site" ? localWebsiteUrl : undefined);
    }
  };

  const handleToggleSelectTopic = (title: string) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(title)) {
      newSelected.delete(title);
    } else {
      newSelected.add(title);
    }
    setSelectedTopics(newSelected);
  };

  const handleSelectAll = () => {
    const allTitles = new Set(topics.map(t => t.title));
    setSelectedTopics(allTitles);
  };

  const handleDeselectAll = () => {
    setSelectedTopics(new Set());
  };

  const handleConfirm = () => {
    if (onConfirmSelection && selectedTopics.size > 0) {
      onConfirmSelection(Array.from(selectedTopics));
      onClose();
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  const isPersonalSite = category === "personal-site";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          background: "#ffffff",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1.5,
          pt: 2.5,
          px: 3,
          borderBottom: "1px solid #e5e7eb",
          background: "#fafafa",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              background: `linear-gradient(135deg, ${categoryColor}08 0%, ${categoryColor}04 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: categoryColor,
            }}
          >
            {categoryIcon}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.3, color: "#111827" }}>
              {categoryLabel}
            </Typography>
            {keyword && (
              <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "0.875rem", mt: 0.25 }}>
                Searching: <Typography component="span" sx={{ fontWeight: 600, color: "#374151" }}>{keyword}</Typography>
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "#fff" }}>
                  Best Practices for Search
                </Typography>
                {BEST_PRACTICES[category].map((tip, idx) => (
                  <Typography key={idx} variant="caption" sx={{ display: "block", mb: 0.5, color: "#e5e7eb" }}>
                    • {tip}
                  </Typography>
                ))}
              </Box>
            }
            arrow
            placement="bottom-end"
          >
            <Chip
              icon={<LightbulbIcon sx={{ fontSize: "14px !important" }} />}
              label="For best results"
              size="small"
              sx={{
                background: categoryBgLight,
                color: categoryColor,
                border: `1px solid ${categoryColor}25`,
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "help",
                "& .MuiChip-icon": { color: categoryColor },
                "&:hover": {
                  background: `${categoryColor}15`,
                },
              }}
            />
          </Tooltip>
          <IconButton onClick={handleClose} size="small" sx={{ color: "#9ca3af" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2, px: 3, minHeight: 360 }}>
        {loading && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8 }}>
            <CircularProgress size={48} sx={{ color: categoryColor, mb: 2.5 }} />
            <Typography variant="h6" sx={{ color: "#374151", fontWeight: 600, mb: 0.5 }}>
              Searching {categoryLabel.toLowerCase()}...
            </Typography>
            <Typography variant="body2" sx={{ color: "#6b7280" }}>
              {isPersonalSite 
                ? `Searching within ${localWebsiteUrl || "your website"}`
                : `Finding relevant ${categoryLabel.toLowerCase()} for your ${productNoun}`}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: 2,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              "& .MuiAlert-icon": { color: "#dc2626" }
            }}
          >
            {error}
          </Alert>
        )}

        {!loading && !error && topics.length === 0 && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Box sx={{ 
              width: 64, 
              height: 64, 
              borderRadius: "50%", 
              background: "#f3f4f6", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              mx: "auto",
              mb: 2
            }}>
              {React.cloneElement(categoryIcon as React.ReactElement, { sx: { fontSize: 32, color: "#d1d5db" } })}
            </Box>
            <Typography variant="h6" sx={{ color: "#374151", fontWeight: 600, mb: 0.5 }}>
              No results found
            </Typography>
            <Typography variant="body2" sx={{ color: "#6b7280" }}>
              {isPersonalSite 
                ? "Enter a website URL and try different keywords"
                : "Try different search terms or redo search"}
            </Typography>
          </Box>
        )}

        {!loading && !error && topics.length > 0 && (
          <>
            {/* Redo Search Bar */}
            <Box 
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 1.5, 
                px: 2, 
                py: 1.5, 
                mb: 2,
                background: "#f9fafb",
                borderRadius: 2,
                border: "1px solid #e5e7eb",
                flexWrap: "wrap",
              }}
            >
              <RefreshIcon sx={{ fontSize: 18, color: categoryColor }} />
              <Typography variant="body2" sx={{ color: "#374151", fontWeight: 500, fontSize: "0.875rem", flexShrink: 0 }}>
                Search again
              </Typography>
              
              {/* Website URL input for Personal Site */}
              {isPersonalSite && (
                <TextField
                  size="small"
                  placeholder="Enter website URL (e.g., example.com)"
                  value={localWebsiteUrl}
                  onChange={(e) => setLocalWebsiteUrl(e.target.value)}
                  sx={{
                    width: 260,
                    "& .MuiOutlinedInput-root": {
                      background: "#fff",
                      fontSize: "0.8rem",
                      height: 34,
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#d1d5db",
                    },
                  }}
                />
              )}
              
              <TextField
                size="small"
                placeholder="Enter search term..."
                value={redoKeyword}
                onChange={(e) => setRedoKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRedoClick()}
                sx={{
                  flex: 1,
                  minWidth: 150,
                  maxWidth: 280,
                  "& .MuiOutlinedInput-root": {
                    background: "#fff",
                    fontSize: "0.8rem",
                    height: 34,
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#d1d5db",
                  },
                }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<SearchIcon sx={{ fontSize: 14 }} />}
                onClick={handleRedoClick}
                disabled={!redoKeyword.trim() || (isPersonalSite && !localWebsiteUrl.trim())}
                sx={{
                  textTransform: "none",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#fff",
                  background: categoryColor,
                  borderRadius: 1.5,
                  px: 1.5,
                  height: 34,
                  "&:hover": {
                    background: categoryColor,
                    opacity: 0.9,
                  },
                  "&:disabled": {
                    background: "#e5e7eb",
                    color: "#9ca3af",
                  },
                }}
              >
                Search
              </Button>
            </Box>
            
            {/* Select All / Deselect All */}
            {topics.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, justifyContent: "flex-end" }}>
                <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "0.8rem", mr: 1 }}>
                  {selectedTopics.size} of {topics.length} selected
                </Typography>
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600, color: categoryColor, minWidth: "auto", px: 1 }}
                >
                  Select All
                </Button>
                <Typography variant="body2" sx={{ color: "#d1d5db" }}>|</Typography>
                <Button
                  size="small"
                  onClick={handleDeselectAll}
                  disabled={selectedTopics.size === 0}
                  sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", minWidth: "auto", px: 1 }}
                >
                  Deselect All
                </Button>
              </Box>
            )}
            
            <Stack spacing={1.5}>
              {topics.map((topic, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: selectedTopics.has(topic.title) 
                      ? `2px solid ${categoryColor}` 
                      : "1px solid #e5e7eb",
                    background: selectedTopics.has(topic.title) 
                      ? categoryBgLight 
                      : "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      background: "#f9fafb",
                      borderColor: categoryColor,
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Checkbox
                      checked={selectedTopics.has(topic.title)}
                      onChange={() => handleToggleSelectTopic(topic.title)}
                      sx={{ 
                        p: 0, 
                        mt: 0.25,
                        color: "#d1d5db",
                        "&.Mui-checked": { color: categoryColor },
                      }}
                    />
                    <Box sx={{ flex: 1 }} onClick={() => handleSelectTopic(topic)}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          lineHeight: 1.5,
                          mb: 0.5,
                          color: "#111827",
                        }}
                      >
                        {topic.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#4b5563",
                          fontSize: "0.8rem",
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {topic.snippet}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
                        {topic.favicon && (
                          <Box
                            component="img"
                            src={topic.favicon}
                            alt=""
                            sx={{ width: 14, height: 14, borderRadius: 0.5 }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "0.75rem" }}>
                          {getDomain(topic.url)}
                        </Typography>
                        <Chip
                          label={`${Math.round(topic.score * 100)}%`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            background: `${categoryColor}12`,
                            color: categoryColor,
                            borderRadius: 1,
                          }}
                        />
                      </Box>
                    </Box>
                    <OpenInNewIcon sx={{ fontSize: 14, color: "#9ca3af", flexShrink: 0, mt: 0.5 }} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ color: "#9ca3af", fontSize: "0.8rem" }}>
          {topics.length} results • {category === "news" || category === "finance" ? "Powered by Tavily" : "Powered by Exa"}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            onClick={handleClose}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#6b7280",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 2,
              px: 2.5,
              py: 0.75,
              "&:hover": {
                background: "#f3f4f6",
                borderColor: "#9ca3af",
              },
            }}
          >
            Discard
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedTopics.size === 0}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#fff",
              background: selectedTopics.size > 0 
                ? `linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}dd 100%)`
                : "#e5e7eb",
              borderRadius: 2,
              px: 2.5,
              py: 0.75,
              "&:hover": {
                background: categoryColor,
                opacity: 0.9,
              },
              "&:disabled": {
                background: "#e5e7eb",
                color: "#9ca3af",
              },
            }}
          >
            Use {selectedTopics.size > 0 ? `${selectedTopics.size} ` : ""}Selected for{" "}
            {productNoun.charAt(0).toUpperCase() + productNoun.slice(1)}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};