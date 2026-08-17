import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  LinearProgress,
  IconButton,
  alpha,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  Public as PublicIcon,
  Search as SearchIcon,
  AutoAwesome as AutoAwesomeIcon,
} from "@mui/icons-material";
import { TrendsChart } from "../../Research/steps/components/TrendsChart";
import { GoogleTrendsData } from "../../Research/types/intent.types";
import { podcastApi } from "../../../services/podcastApi";
import { normalizeTrendsKeywords } from "../../../utils/trendsKeywords";

interface TrendingTopicsModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTopic: (topic: string) => void;
  initialKeywords: string;
  /** "web" = Google web trends (Podcast default). "podcast" = YouTube search interest. */
  source?: "web" | "podcast";
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

export const TrendingTopicsModal: React.FC<TrendingTopicsModalProps> = ({
  open,
  onClose,
  onSelectTopic,
  initialKeywords,
  source = "web",
}) => {
  const [trendsData, setTrendsData] = useState<GoogleTrendsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const fetchTrends = useCallback(async () => {
    if (!initialKeywords.trim()) return;

    const keywords = normalizeTrendsKeywords(
      initialKeywords
        .split(/[,;]+/)
        .map((k) => k.trim())
        .filter(Boolean),
    );

    if (keywords.length === 0) return;

    setLoading(true);
    setError(null);
    setTrendsData(null);

    const trendsSource = source || "web";
    const keywordPreview = keywords[0]?.slice(0, 50) || "";
    console.info("[TrendingTopics] Fetch started", {
      keywordCount: keywords.length,
      source: trendsSource,
      keywordPreview,
    });

    try {
      const result = await podcastApi.getTrendingTopics({
        keywords,
        timeframe: "today 12-m",
        geo: "US",
        source: trendsSource,
      });

      if (result.success && result.data) {
        setTrendsData(result.data as GoogleTrendsData);
      } else {
        const errorMsg =
          result.error ||
          "Failed to fetch trends data. Google may be rate-limiting requests — please try again in a few minutes.";
        console.warn("[TrendingTopics] Fetch returned success=false", {
          source: trendsSource,
          error: errorMsg,
        });
        setError(errorMsg);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      let msg = "Failed to fetch trending topics. Please try again later.";
      if (status === 401) {
        msg = "Please sign in again.";
      } else if (status === 504) {
        msg =
          (typeof detail === "string" && detail.trim()) ||
          "Google Trends took too long. Try a shorter idea with 2-4 words (e.g. 'Bali travel').";
      } else if (status === 429) {
        msg =
          (typeof detail === "string" && detail.trim()) ||
          (detail && typeof detail === "object" && (detail.message || detail.error)) ||
          (typeof err?.response?.data?.message === "string" && err.response.data.message) ||
          "Trends request limit reached. Please try again later.";
      } else if (status === 503) {
        msg =
          (typeof detail === "string" && detail) ||
          (detail && typeof detail === "object" && (detail.message || detail.error)) ||
          "Trends is temporarily unavailable.";
      } else if (typeof detail === "string" && detail.trim()) {
        msg = detail;
      } else if (detail && typeof detail === "object") {
        msg = detail.message || detail.error || msg;
      } else if (err?.message) {
        msg = err.message;
      }
      console.error("[TrendingTopics] Fetch failed", { status, source: trendsSource, message: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initialKeywords, source]);

  useEffect(() => {
    if (open && initialKeywords.trim()) {
      fetchTrends();
    }
  }, [open, initialKeywords, fetchTrends]);

  const handleSelectTopic = (topic: string) => {
    onSelectTopic(topic);
    onClose();
  };

  const handleClose = () => {
    setTrendsData(null);
    setError(null);
    setTabValue(0);
    onClose();
  };

  const regions = trendsData?.interest_by_region || [];
  const relatedTopics = trendsData?.related_topics || { top: [], rising: [] };
  const relatedQueries = trendsData?.related_queries || { top: [], rising: [] };
  const hasAnyData = trendsData
    && (
      trendsData.interest_over_time?.length > 0
      || trendsData.interest_by_region?.length > 0
      || trendsData.related_topics?.top?.length > 0
      || trendsData.related_topics?.rising?.length > 0
      || trendsData.related_queries?.top?.length > 0
      || trendsData.related_queries?.rising?.length > 0
    );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
          background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUpIcon sx={{ color: "#fff", fontSize: "1.25rem" }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", fontSize: "1.1rem" }}>
              Trending Topics
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Google Trends insights for &ldquo;{initialKeywords}&rdquo;
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleClose} sx={{ color: "#64748b" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        {loading && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={40} sx={{ color: "#667eea", mb: 2 }} />
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Fetching trending topics from Google Trends...
            </Typography>
            <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && trendsData && !hasAnyData && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <TrendingUpIcon sx={{ fontSize: 48, color: "#f59e0b", mb: 1 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, color: "#0f172a", mb: 1 }}>
              No trends data available
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
              Google Trends could not find data for &ldquo;{initialKeywords}&rdquo;.
              {trendsData.error
                ? " This may be due to rate limiting — please try again in a few minutes."
                : " The topic may be too specific. Try a broader keyword."}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchTrends}
              sx={{ textTransform: "none", borderColor: "#667eea", color: "#667eea" }}
            >
              Retry
            </Button>
          </Box>
        )}

        {!loading && trendsData && hasAnyData && (
          <>
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                },
                "& .Mui-selected": {
                  color: "#667eea",
                },
                "& .MuiTabs-indicator": {
                  background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                },
              }}
            >
              <Tab icon={<TrendingUpIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Interest Chart" />
              <Tab icon={<PublicIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Regions" />
              <Tab icon={<AutoAwesomeIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Related Topics" />
              <Tab icon={<SearchIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Related Queries" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              <Box sx={{ mt: 1 }}>
                <TrendsChart data={trendsData} height={280} showAverage={true} />
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {regions.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <PublicIcon sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    No regional data available for this topic.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 350, overflow: "auto" }}>
                  {regions.slice(0, 15).map((region: any, idx: number) => {
                    const regionName = region.regionName || region.geoName || region.name || `Region ${idx + 1}`;
                    const value = region.value || region.interest || 0;
                    const maxVal = Math.max(...regions.slice(0, 15).map((r: any) => r.value || r.interest || 0));
                    const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 1,
                          borderRadius: 1,
                          "&:hover": { background: "rgba(102, 126, 234, 0.04)" },
                        }}
                      >
                        <Typography variant="body2" sx={{ minWidth: 30, fontWeight: 600, color: "#64748b" }}>
                          {idx + 1}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: "#0f172a" }}>
                          {regionName}
                        </Typography>
                        <Box sx={{ flex: 1, maxWidth: 200 }}>
                          <Box
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              background: "rgba(102, 126, 234, 0.1)",
                              position: "relative",
                            }}
                          >
                            <Box
                              sx={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${pct}%`,
                                borderRadius: 4,
                                background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                                transition: "width 0.3s ease",
                              }}
                            />
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#667eea", minWidth: 30 }}>
                          {value}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {relatedTopics.top.length === 0 && relatedTopics.rising.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <AutoAwesomeIcon sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    No related topics data available.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {relatedTopics.rising.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: "#059669", fontWeight: 700 }}>
                        Rising Topics
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {relatedTopics.rising.map((topic: any, idx: number) => {
                          const label = topic.topic_title || topic.title || topic.query || String(topic);
                          return (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              onClick={() => handleSelectTopic(label)}
                              sx={{
                                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)",
                                color: "#059669",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                mb: 0.5,
                                "&:hover": {
                                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)",
                                },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                  {relatedTopics.top.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: "#667eea", fontWeight: 700 }}>
                        Top Topics
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {relatedTopics.top.map((topic: any, idx: number) => {
                          const label = topic.topic_title || topic.title || topic.query || String(topic);
                          return (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              onClick={() => handleSelectTopic(label)}
                              sx={{
                                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                color: "#667eea",
                                border: "1px solid rgba(102, 126, 234, 0.25)",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                mb: 0.5,
                                "&:hover": {
                                  background: "linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(118, 75, 162, 0.18) 100%)",
                                },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {relatedQueries.top.length === 0 && relatedQueries.rising.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <SearchIcon sx={{ fontSize: 40, color: "#cbd5e1", mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    No related queries data available.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {relatedQueries.rising.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: "#059669", fontWeight: 700 }}>
                        Rising Queries
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {relatedQueries.rising.map((query: any, idx: number) => {
                          const label = query.query || query.title || String(query);
                          return (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              onClick={() => handleSelectTopic(label)}
                              sx={{
                                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)",
                                color: "#d97706",
                                border: "1px solid rgba(245, 158, 11, 0.25)",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                mb: 0.5,
                                "&:hover": {
                                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.18) 100%)",
                                },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                  {relatedQueries.top.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: "#667eea", fontWeight: 700 }}>
                        Top Queries
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {relatedQueries.top.map((query: any, idx: number) => {
                          const label = query.query || query.title || String(query);
                          return (
                            <Chip
                              key={idx}
                              label={label}
                              size="small"
                              onClick={() => handleSelectTopic(label)}
                              sx={{
                                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                color: "#667eea",
                                border: "1px solid rgba(102, 126, 234, 0.25)",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                mb: 0.5,
                                "&:hover": {
                                  background: "linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(118, 75, 162, 0.18) 100%)",
                                },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </TabPanel>
          </>
        )}

        {!loading && !error && !trendsData && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <TrendingUpIcon sx={{ fontSize: 48, color: "#cbd5e1", mb: 1 }} />
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Enter a topic and click &ldquo;Get Trending Topics&rdquo; to see Google Trends data.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" sx={{ color: "#94a3b8" }}>
          Data from Google Trends
        </Typography>
        <Button
          onClick={handleClose}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: "#64748b",
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};