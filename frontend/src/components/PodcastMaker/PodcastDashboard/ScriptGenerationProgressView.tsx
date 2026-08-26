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
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import ChatIcon from '@mui/icons-material/Chat';

const SCRIPT_GENERATION_MESSAGES = [
  { title: "Analyzing Research Data", message: "Extracting key insights, facts, and statistics from your research..." },
  { title: "Building Structure", message: "Creating podcast structure with scenes and segments..." },
  { title: "Writing Dialogue", message: "Writing AI-powered dialogue personalized to your audience..." },
  { title: "Finalizing Script", message: "Finalizing scenes with proper pacing for text-to-speech..." },
];

const SCRIPT_BENEFITS = [
  {
    title: "Research-Grounded Content",
    description: "Your script cites real facts and sources from the research phase",
    icon: <BoltIcon />,
    color: "#10b981",
  },
  {
    title: "Audience-Targeted",
    description: "Dialogue written for your specific target audience",
    icon: <PsychologyIcon />,
    color: "#a78bfa",
  },
  {
    title: "Optimized for TTS",
    description: "Proper pacing and hints for natural text-to-speech output",
    icon: <VolumeUpIcon />,
    color: "#60a5fa",
  },
];

const WHAT_IS_SCENE = {
  title: "What is a Scene?",
  definition: "A scene is a single section of your podcast episode. It contains dialogue from presenters and optional chart data for visuals.",
  icon: <TheaterComedyIcon />,
  color: "#34d399",
};

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
    phase: "Write Script",
    icon: <EditIcon />,
    color: "#34d399",
    description: "Transforms research into structured script",
    benefit: "Factual, engaging content",
    isCurrent: true,
  },
  {
    phase: "Final Render",
    icon: <VideoLibraryIcon />,
    color: "#ef4444",
    description: "Your ready-to-publish podcast episode",
    benefit: "Professional output"
  },
];

const SCRIPT_EDITOR_PREVIEW = [
  { label: "Edit Dialogue", description: "Click any line to modify the text", icon: <EditIcon /> },
  { label: "Approve Scenes", description: "Mark scenes as ready for rendering", icon: <CheckCircleIcon /> },
  { label: "Regenerate", description: "Regenerate specific scenes if needed", icon: <AutoAwesomeIcon /> },
  { label: "Add Charts", description: "Charts auto-generated from research facts", icon: <FormatListBulletedIcon /> },
];

interface ScriptGenerationProgressViewProps {
  currentMessage?: string;
  progressIndex: number;
  idea?: string;
  analysis?: any;
  research?: any;
  sourceCount?: number;
}

export const ScriptGenerationProgressView: React.FC<ScriptGenerationProgressViewProps> = ({
  currentMessage,
  progressIndex,
  idea,
  analysis,
  research,
  sourceCount,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const clampedIndex = Math.min(progressIndex, SCRIPT_GENERATION_MESSAGES.length - 1);

  const audience = analysis?.audience || "General audience";
  const keywords = analysis?.topKeywords?.slice(0, 5) || [];
  const outlineTitle = analysis?.suggestedOutlines?.[0]?.title || "Not specified";
  const factCards = research?.factCards || [];
  const keyInsights = research?.keyInsights || [];
  const searchQueries = research?.searchQueries || [];

  return (
    <Stack spacing={2}>
      {/* Current Status */}
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={isMobile ? 50 : 60} thickness={3} sx={{ color: "#34d399" }} />
          <Box sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <EditIcon sx={{ color: "#34d399", fontSize: isMobile ? 20 : 24 }} />
          </Box>
        </Box>

        <Typography variant="subtitle1" sx={{ color: "#34d399", fontWeight: 600, mt: 1, fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
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
            "& .MuiLinearProgress-bar": { bgcolor: "#34d399", borderRadius: 2 },
          }}
        />
        
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5, display: "block" }}>
          Step {clampedIndex + 1} of {SCRIPT_GENERATION_MESSAGES.length}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* How Prior Phases Are Used */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          How We're Personalizing Your Script
        </Typography>
        
        <Stack spacing={1}>
          {/* Analysis Context */}
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "rgba(167, 139, 250, 0.1)", border: "1px solid rgba(167, 139, 250, 0.2)" }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(167, 139, 250, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AutoAwesomeIcon sx={{ color: "#a78bfa", fontSize: 14 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.75rem", display: "block" }}>
                  From Analyze Phase
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", display: "block" }}>
                  <strong>Audience:</strong> {audience}
                </Typography>
                {keywords.length > 0 && (
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", display: "block" }}>
                    <strong>Keywords:</strong> {keywords.join(", ")}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

          {/* Research Context */}
          <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "rgba(96, 165, 250, 0.1)", border: "1px solid rgba(96, 165, 250, 0.2)" }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(96, 165, 250, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <SearchIcon sx={{ color: "#60a5fa", fontSize: 14 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: "#60a5fa", fontWeight: 600, fontSize: "0.75rem", display: "block" }}>
                  From Research Phase
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", display: "block" }}>
                  <strong>{factCards.length} facts</strong>, <strong>{keyInsights.length} insights</strong>, <strong>{sourceCount || 0} sources</strong>
                </Typography>
                {searchQueries.length > 0 && (
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.7rem", display: "block" }}>
                    From {searchQueries.length} research queries
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* What is a Scene */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          {WHAT_IS_SCENE.title}
        </Typography>
        <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: "rgba(52, 211, 153, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {React.cloneElement(WHAT_IS_SCENE.icon, { sx: { color: WHAT_IS_SCENE.color, fontSize: 16 } })}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", display: "block" }}>
                {WHAT_IS_SCENE.definition}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

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
                  bgcolor: isCompleted ? "#10b981" : isCurrent ? "#34d399" : "rgba(255,255,255,0.1)",
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
                    color: isCompleted ? "rgba(255,255,255,0.5)" : isCurrent ? "#34d399" : "rgba(255,255,255,0.6)", 
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

      {/* What to Expect in Script Editor */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          What's Next: Script Editor
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {SCRIPT_EDITOR_PREVIEW.map((item, idx) => (
            <Box key={idx} sx={{ flex: "1 1 45%", minWidth: 100, p: 1.5, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
              <Stack spacing={0.5}>
                <Box sx={{ color: "#a78bfa" }}>{React.cloneElement(item.icon, { sx: { fontSize: 18 } })}</Box>
                <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.7rem", display: "block" }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", display: "block" }}>
                  {item.description}
                </Typography>
              </Stack>
            </Box>
          ))}
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
            <Box key={idx} sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: phase.isCurrent ? "rgba(52, 211, 153, 0.1)" : "rgba(255,255,255,0.05)", 
              border: `1px solid ${phase.isCurrent ? "rgba(52, 211, 153, 0.3)" : "rgba(255,255,255, 0.1)"}`
            }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: "50%", 
                  bgcolor: phase.isCurrent ? "rgba(52, 211, 153, 0.2)" : `${phase.color}20`, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {React.cloneElement(phase.icon, { sx: { color: phase.isCurrent ? "#34d399" : phase.color, fontSize: 16 } })}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: phase.isCurrent ? "#34d399" : "#fff", fontWeight: 600, fontSize: "0.8rem" }}>
                    {phase.phase} {phase.isCurrent && "◀ In Progress"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.7rem", display: "block" }}>
                    {phase.description}
                  </Typography>
                  <Typography variant="caption" sx={{ color: phase.isCurrent ? "#34d399" : phase.color, fontSize: "0.65rem", display: "block", mt: 0.25 }}>
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