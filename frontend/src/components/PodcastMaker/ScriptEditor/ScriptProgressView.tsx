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
import { Research } from "../types";

const SCRIPT_GENERATION_MESSAGES = [
  { title: "Processing Research", message: "Extracting key insights, statistics, and quotes from your research data..." },
  { title: "Analyzing Your Topic", message: "Using your topic to shape the episode narrative and content structure..." },
  { title: "Structuring Scenes", message: "Creating scene-by-scene breakdown based on research findings..." },
  { title: "Writing Dialogue", message: "Generating natural conversation that flows from your insights..." },
  { title: "Adding Transitions", message: "Creating smooth flow between scenes and topics..." },
  { title: "Optimizing Pacing", message: "Ensuring engaging rhythm throughout the episode..." },
  { title: "Final Review", message: "Validating script quality and preparing for editing..." },
];

const RESEARCH_STATS_CONFIG = [
  { label: "Key Insights", key: "keyInsights", icon: <InsightsIcon />, color: "#a78bfa" },
  { label: "Fact Cards", key: "factCards", icon: <FactCheckIcon />, color: "#34d399" },
  { label: "Angles", key: "mappedAngles", icon: <LightbulbIcon />, color: "#f59e0b" },
  { label: "Sources", key: "sourceCount", icon: <SearchIcon />, color: "#60a5fa", isNumber: true },
];

const PODCAST_CREATION_JOURNEY = [
  {
    phase: "Generate Script",
    icon: <AutoAwesomeIcon />,
    color: "#a78bfa",
    description: "AI transforms research into a structured podcast script",
    benefit: "Professional script based on your research insights"
  },
  {
    phase: "Edit Scenes",
    icon: <EditIcon />,
    color: "#34d399",
    description: "Review and refine each scene in the Script Editor",
    benefit: "Full control over your content"
  },
  {
    phase: "Approve Content",
    icon: <CheckCircleIcon />,
    color: "#10b981",
    description: "Mark scenes as approved before audio generation",
    benefit: "Ensures content isexactly as you want"
  },
  {
    phase: "Generate Audio",
    icon: <VolumeUpIcon />,
    color: "#f59e0b",
    description: "Convert script to natural-sounding podcast audio",
    benefit: "Ready-to-use audio narration"
  },
  {
    phase: "Final Render",
    icon: <VideoLibraryIcon />,
    color: "#ef4444",
    description: "Combine into your final podcast episode",
    benefit: "Download or share your episode"
  },
];

interface ScriptProgressViewProps {
  currentMessage?: string;
  progressIndex: number;
  research?: Research | null;
  idea?: string;
}

export const ScriptProgressView: React.FC<ScriptProgressViewProps> = ({
  currentMessage,
  progressIndex,
  research,
  idea,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const clampedIndex = Math.min(progressIndex, SCRIPT_GENERATION_MESSAGES.length - 1);

  const getResearchValue = (key: string, isNumber?: boolean) => {
    if (!research) return 0;
    const value = (research as any)[key];
    if (isNumber) return research.sourceCount || 0;
    return Array.isArray(value) ? value.length : value || 0;
  };

  return (
    <Stack spacing={2}>
      {/* Current Status */}
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={isMobile ? 50 : 60} thickness={3} sx={{ color: "#a78bfa" }} />
          <Box sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <AutoAwesomeIcon sx={{ color: "#a78bfa", fontSize: isMobile ? 20 : 24 }} />
          </Box>
        </Box>

        <Typography variant="subtitle1" sx={{ color: "#a78bfa", fontWeight: 600, mt: 1, fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
          {SCRIPT_GENERATION_MESSAGES[clampedIndex].title}
        </Typography>
        
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, fontSize: isMobile ? "0.75rem" : "0.85rem", px: 1 }}>
          {currentMessage || SCRIPT_GENERATION_MESSAGES[clampedIndex].message}
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
            "& .MuiLinearProgress-bar": { bgcolor: "#a78bfa", borderRadius: 2 },
          }}
        />
        
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5, display: "block" }}>
          Step {clampedIndex + 1} of {SCRIPT_GENERATION_MESSAGES.length}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Research Stats */}
      {research && (
        <Box sx={{ width: "100%" }}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
            Using Your Research
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {RESEARCH_STATS_CONFIG.map((stat, idx) => {
              const value = getResearchValue(stat.key, stat.isNumber);
              return (
                <Box key={idx} sx={{ 
                  flex: "1 1 auto",
                  minWidth: 80,
                  p: 1, 
                  borderRadius: 1.5, 
                  bgcolor: "rgba(255,255,255,0.05)", 
                  border: "1px solid rgba(255,255,255,0.1)",
                  textAlign: "center",
                }}>
                  <Box sx={{ color: stat.color, mb: 0.25 }}>{stat.icon}</Box>
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>
                    {value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem" }}>
                    {stat.label}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Sequential Progress Steps */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          Script Generation Progress
        </Typography>
        <Stack spacing={0.5}>
          {SCRIPT_GENERATION_MESSAGES.map((msg, idx) => {
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
                  bgcolor: isCompleted ? "#10b981" : isCurrent ? "#a78bfa" : "rgba(255,255,255,0.1)",
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
                    color: isCompleted ? "rgba(255,255,255,0.5)" : isCurrent ? "#a78bfa" : "rgba(255,255,255,0.6)", 
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