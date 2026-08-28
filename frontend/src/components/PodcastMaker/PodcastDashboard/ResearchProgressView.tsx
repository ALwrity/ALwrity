import React from "react";
import {
  Stack,
  Typography,
  CircularProgress,
  LinearProgress,
  Box,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InsightsIcon from '@mui/icons-material/Insights';
import ArticleIcon from '@mui/icons-material/Article';
import EditIcon from '@mui/icons-material/Edit';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SearchIcon from '@mui/icons-material/Search';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SchoolIcon from '@mui/icons-material/School';
import UpdateIcon from '@mui/icons-material/Update';
import BoltIcon from '@mui/icons-material/Bolt';

const RESEARCH_MESSAGES = [
  { title: "Starting Research", message: "Preparing research queries and configuring search parameters..." },
  { title: "Searching Web", message: "Searching the web for relevant content, statistics, and latest developments..." },
  { title: "Analyzing Results", message: "Analyzing search results for key insights and factual information..." },
  { title: "Extracting Insights", message: "Extracting valuable insights, quotes, and data from verified sources..." },
  { title: "Validating Facts", message: "Cross-referencing information to ensure accuracy and credibility..." },
  { title: "Final Review", message: "Finalizing research data and preparing comprehensive summary..." },
];

const RESEARCH_BENEFITS = [
  {
    title: "Prevents AI Hallucinations",
    description: "Research provides factual grounding so AI doesn't make up information",
    icon: <BoltIcon />,
    color: "#f59e0b",
  },
  {
    title: "Latest Information",
    description: "Gets up-to-date facts, statistics, and developments beyond AI's training date",
    icon: <UpdateIcon />,
    color: "#3b82f6",
  },
  {
    title: "Credible Sources",
    description: "Cites authoritative sources to build trust with your audience",
    icon: <SchoolIcon />,
    color: "#10b981",
  },
];

const RESEARCH_STATS_CONFIG = [
  { label: "Queries", key: "searchQueries", icon: <SearchIcon />, color: "#a78bfa" },
  { label: "Sources", key: "sourceCount", icon: <ArticleIcon />, color: "#34d399", isNumber: true },
  { label: "Insights", key: "keyInsights", icon: <InsightsIcon />, color: "#f59e0b" },
  { label: "Facts", key: "factCards", icon: <FactCheckIcon />, color: "#60a5fa" },
];

const PODCAST_CREATION_JOURNEY = [
  {
    phase: "Analyze",
    icon: <AutoAwesomeIcon />,
    color: "#a78bfa",
    description: "AI understands your topic and target audience",
    benefit: "Identifies key themes and angles"
  },
  {
    phase: "Research",
    icon: <SearchIcon />,
    color: "#60a5fa",
    description: "Gathers facts, statistics, and latest insights",
    benefit: "Evidence-based content"
  },
  {
    phase: "Generate Script",
    icon: <EditIcon />,
    color: "#34d399",
    description: "Transforms research into structured script",
    benefit: "Factual, engaging content"
  },
  {
    phase: "Final Render",
    icon: <VideoLibraryIcon />,
    color: "#ef4444",
    description: "Your ready-to-publish podcast episode",
    benefit: "Professional output"
  },
];

interface ResearchProgressViewProps {
  currentMessage?: string;
  progressIndex: number;
  searchQueries?: string[];
  provider?: string;
  searchType?: string;
}

export const ResearchProgressView: React.FC<ResearchProgressViewProps> = ({
  currentMessage,
  progressIndex,
  searchQueries,
  provider,
  searchType,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const clampedIndex = Math.min(progressIndex, RESEARCH_MESSAGES.length - 1);

  return (
    <Stack spacing={2}>
      {/* Current Status */}
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={isMobile ? 50 : 60} thickness={3} sx={{ color: "#60a5fa" }} />
          <Box sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <SearchIcon sx={{ color: "#60a5fa", fontSize: isMobile ? 20 : 24 }} />
          </Box>
        </Box>

        <Typography variant="subtitle1" sx={{ color: "#60a5fa", fontWeight: 600, mt: 1, fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
          {RESEARCH_MESSAGES[clampedIndex].title}
        </Typography>
        
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, fontSize: isMobile ? "0.75rem" : "0.85rem", px: 1 }}>
          {currentMessage || RESEARCH_MESSAGES[clampedIndex].message}
        </Typography>

        {currentMessage && (
          <Typography variant="caption" sx={{ color: "#10b981", mt: 0.5, display: "block", fontSize: "0.75rem" }}>
            {currentMessage}
          </Typography>
        )}

        <LinearProgress
          sx={{
            width: "100%",
            height: 4,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.1)",
            mt: 2,
            "& .MuiLinearProgress-bar": { bgcolor: "#60a5fa", borderRadius: 2 },
          }}
        />
        
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5, display: "block" }}>
          Step {clampedIndex + 1} of {RESEARCH_MESSAGES.length}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Why Research Matters */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          Why Research Matters
        </Typography>
        <Stack spacing={1}>
          {RESEARCH_BENEFITS.map((benefit, idx) => (
            <Box key={idx} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: "50%", 
                  bgcolor: `${benefit.color}20`, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {React.cloneElement(benefit.icon, { sx: { color: benefit.color, fontSize: 14 } })}
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.75rem", display: "block" }}>
                    {benefit.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", display: "block" }}>
                    {benefit.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Search Info */}
      {(provider || searchType || searchQueries) && (
        <>
          <Box sx={{ width: "100%" }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
              Research Configuration
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {provider && (
                <Box sx={{ flex: "1 1 auto", minWidth: 80, p: 1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", display: "block" }}>Provider</Typography>
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase" }}>
                    {provider}
                  </Typography>
                </Box>
              )}
              {searchType && (
                <Box sx={{ flex: "1 1 auto", minWidth: 80, p: 1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", display: "block" }}>Search Type</Typography>
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.8rem", textTransform: "capitalize" }}>
                    {searchType}
                  </Typography>
                </Box>
              )}
              {searchQueries && (
                <Box sx={{ flex: "1 1 auto", minWidth: 80, p: 1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", display: "block" }}>Queries</Typography>
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.8rem" }}>
                    {searchQueries.length}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
        </>
      )}

      {/* Sequential Progress Steps */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          Research Progress
        </Typography>
        <Stack spacing={0.5}>
          {RESEARCH_MESSAGES.map((msg, idx) => {
            const isCompleted = idx < clampedIndex;
            const isCurrent = idx === clampedIndex;
            return (
              <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ 
                  width: 18, 
                  height: 18, 
                  borderRadius: "50%", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  bgcolor: isCompleted ? "#10b981" : isCurrent ? "#60a5fa" : "rgba(255,255,255,0.1)",
                  flexShrink: 0,
                }}>
                  {isCompleted ? (
                    <CheckCircleIcon sx={{ fontSize: 12, color: "#fff" }} />
                  ) : isCurrent ? (
                    <CircularProgress size={10} sx={{ color: "#fff" }} />
                  ) : (
                    <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.3)" }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ 
                    color: isCompleted ? "rgba(255,255,255,0.5)" : isCurrent ? "#60a5fa" : "rgba(255,255,255,0.6)", 
                    fontWeight: isCurrent ? 600 : 400,
                    fontSize: "0.75rem",
                    textDecoration: isCompleted ? "line-through" : "none",
                  }}>
                    {msg.title}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Journey Overview */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          Your Podcast Journey
        </Typography>
        <Stack spacing={1}>
          {PODCAST_CREATION_JOURNEY.map((phase, idx) => (
            <Box key={idx} sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: "50%", 
                  bgcolor: `${phase.color}20`, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {React.cloneElement(phase.icon, { sx: { color: phase.color, fontSize: 16 } })}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.8rem" }}>
                    {phase.phase}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.7rem", display: "block" }}>
                    {phase.description}
                  </Typography>
                  <Typography variant="caption" sx={{ color: phase.color, fontSize: "0.65rem", display: "block", mt: 0.25 }}>
                    ✓ {phase.benefit}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};