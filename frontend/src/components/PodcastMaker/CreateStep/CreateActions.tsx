import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack,
  Typography,
  Chip,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Box,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  LinearProgress,
  Divider,
  useMediaQuery,
  useTheme,
  Collapse,
} from "@mui/material";
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TitleIcon from '@mui/icons-material/Title';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import VideoIcon from '@mui/icons-material/VideoCameraFront';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import ArticleIcon from '@mui/icons-material/Article';
import CampaignIcon from '@mui/icons-material/Campaign';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import ErrorIcon from '@mui/icons-material/Error';
import { PrimaryButton, SecondaryButton } from "../ui";

interface CreateActionsProps {
  reset: () => void;
  submit: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  announcement?: string;
  onAnnouncementClear?: () => void;
  error?: string | null;
}

const ANALYSIS_FEATURES = [
  { icon: <AnalyticsIcon />, text: "Target audience & content type analysis" },
  { icon: <ListAltIcon />, text: "5 high-impact keywords for discoverability" },
  { icon: <TitleIcon />, text: "3 catchy episode title suggestions" },
  { icon: <PsychologyIcon />, text: "2 detailed episode outlines with segments" },
  { icon: <RecordVoiceOverIcon />, text: "4-6 research queries for AI-powered research" },
  { icon: <CheckCircleIcon />, text: "Episode hook, key takeaways & listener CTA" },
];

// Sequential educational messages - displayed one after another
const EDUCATIONAL_MESSAGES = [
  { title: "Understanding Your Topic", message: "AI is analyzing your topic to identify the core theme, target audience, and content type..." },
  { title: "Audience Persona", message: "Building a detailed audience persona including demographics, interests, and pain points..." },
  { title: "Keyword Research", message: "Discovering high-impact keywords that will make your podcast discoverable in search..." },
  { title: "Title Optimization", message: "Generating catchy, SEO-friendly title suggestions that capture attention..." },
  { title: "Content Structure", message: "Creating a compelling narrative arc with hooks, segments, and call-to-actions..." },
  { title: "Research Queries", message: "Preparing intelligent research questions that will gather facts and insights..." },
  { title: "Episode Outline", message: "Drafting a structured outline with timestamps and key talking points..." },
  { title: "Quality Check", message: "Validating all generated content for accuracy and engagement potential..." },
];

const PODCAST_CREATION_JOURNEY = [
  {
    phase: "Analysis",
    icon: <AnalyticsIcon />,
    color: "#a78bfa",
    description: "AI learns your topic inside-out",
    details: [
      "Identifies target audience demographics and interests",
      "Extracts key themes and angles to explore",
      "Generates research queries for deep diving",
    ],
    benefit: "Ensures your content resonates with the right people"
  },
  {
    phase: "Research",
    icon: <SearchIcon />,
    color: "#60a5fa",
    description: "Deep dive into facts and insights",
    details: [
      "Gathers statistics, quotes, and case studies",
      "Finds trending topics and recent developments",
      "Validates claims with credible sources",
    ],
    benefit: "Adds credibility and depth to your episode"
  },
  {
    phase: "Script",
    icon: <EditIcon />,
    color: "#34d399",
    description: "AI crafts your episode narrative",
    details: [
      "Creates scene-by-scene breakdowns",
      "Writes natural dialogue and transitions",
      "Optimizes pacing for engagement",
    ],
    benefit: "Professional script without hours of writing"
  },
  {
    phase: "Render",
    icon: <VideoIcon />,
    color: "#f472b6",
    description: "Bring it all together visually",
    details: [
      "Combines voice clone with avatar",
      "Adds visual effects and transitions",
      "Exports studio-quality video",
    ],
    benefit: "Ready-to-publish podcast video"
  },
];

const MARKETING_INSIGHTS = [
  { icon: <TrendingUpIcon />, title: "Brand Recognition", text: "Consistent podcasting builds brand authority and trust" },
  { icon: <GroupsIcon />, title: "Audience Growth", text: "AI-optimized content attracts and retains listeners" },
  { icon: <SchoolIcon />, title: "Thought Leadership", text: "Research-backed content positions you as an expert" },
  { icon: <CampaignIcon />, title: "Marketing Funnel", text: "Podcasts drive traffic to your products and services" },
];

const USE_CASES = [
  { icon: <HeadphonesIcon />, title: "Regular Episodes", text: "Weekly/bi-weekly podcast episodes" },
  { icon: <ArticleIcon />, title: "Content Repurposing", text: "Turn blogs and videos into podcasts" },
  { icon: <CampaignIcon />, title: "Marketing Campaigns", text: "Launch promotions with audio content" },
];

const INFO_BANNER_TEXT =
  "Podcast avatar Image is required. Brand avatar is default. You can choose from asset library or upload your picture. If not, AI Avatar will be generated automatically.";

const styles = {
  dialog: {
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    border: "1px solid rgba(167, 139, 250, 0.3)",
    borderRadius: 3,
  },
  infoAlert: {
    background: alpha("#f0f4ff", 0.6),
    border: "1px solid rgba(99, 102, 241, 0.15)",
    borderRadius: 2,
    boxShadow: "0 1px 3px rgba(99, 102, 241, 0.08)",
  },
  dialogContent: {
    color: "rgba(255,255,255,0.8)",
    minHeight: 200,
    py: 2,
    px: { xs: 2, sm: 3 },
    maxHeight: { xs: "80vh", sm: "70vh" },
    overflowY: "auto",
  },
};

const InfoBanner: React.FC<{ showInfo: boolean; setShowInfo: (v: boolean) => void }> = ({
  showInfo,
  setShowInfo,
}) => (
  <Collapse in={showInfo}>
    <Alert
      severity="info"
      icon={<InfoIcon sx={{ color: "#6366f1", fontSize: "1.125rem" }} />}
      onClose={() => setShowInfo(false)}
      sx={styles.infoAlert}
    >
      <Typography variant="body2" sx={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.6, fontWeight: 400 }}>
        {INFO_BANNER_TEXT}
      </Typography>
    </Alert>
  </Collapse>
);

const ShowTipsLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <InfoIcon sx={{ fontSize: 16, color: "#6366f1" }} />
    <Typography variant="caption" sx={{ color: "#6366f1", cursor: "pointer", "&:hover": { textDecoration: "underline" } }} onClick={onClick}>
      Show tips
    </Typography>
  </Stack>
);

const AnalysisProgressView: React.FC<{ currentMessage?: string; progressIndex: number }> = ({ currentMessage, progressIndex }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const clampedIndex = Math.min(progressIndex, EDUCATIONAL_MESSAGES.length - 1);
  
  return (
    <Stack spacing={2} sx={styles.dialogContent}>
      {/* Current Status */}
      <Box sx={{ textAlign: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={isMobile ? 50 : 60} thickness={3} sx={{ color: "#a78bfa" }} />
          <Box sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <AutoAwesomeIcon sx={{ color: "#a78bfa", fontSize: isMobile ? 20 : 24 }} />
          </Box>
        </Box>

        <Typography variant="subtitle1" sx={{ color: "#a78bfa", fontWeight: 600, mt: 1, fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
          {EDUCATIONAL_MESSAGES[clampedIndex].title}
        </Typography>
        
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 0.5, fontSize: isMobile ? "0.75rem" : "0.85rem", px: 1 }}>
          {EDUCATIONAL_MESSAGES[clampedIndex].message}
        </Typography>

        {currentMessage && currentMessage !== EDUCATIONAL_MESSAGES[clampedIndex].message && (
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
          Step {clampedIndex + 1} of {EDUCATIONAL_MESSAGES.length}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Sequential Progress Steps */}
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
          Analysis Progress
        </Typography>
        <Stack spacing={0.5}>
          {EDUCATIONAL_MESSAGES.map((msg, idx) => {
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

      {/* Journey Overview - Responsive */}
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

      {!isMobile && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

          {/* Marketing Insights */}
          <Box sx={{ width: "100%" }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem", mb: 1, display: "block" }}>
              Marketing Benefits
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {MARKETING_INSIGHTS.map((insight, idx) => (
                <Chip
                  key={idx}
                  icon={React.cloneElement(insight.icon, { sx: { fontSize: 14, color: "#a78bfa" } })}
                  label={insight.title}
                  size="small"
                  sx={{
                    bgcolor: "rgba(167, 139, 250, 0.1)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: "0.65rem",
                    height: 24,
                    mb: 0.5,
                    "& .MuiChip-label": { fontSize: "0.65rem", px: 1 },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  );
};

const WhatYoullGetView: React.FC<{ isMobile?: boolean }> = ({ isMobile }) => (
  <>
    <Typography variant="body2" sx={{ mb: 2, color: "rgba(255,255,255,0.7)", fontSize: isMobile ? "0.85rem" : "0.9rem" }}>
      Click "Start Analysis" to begin AI-powered podcast planning. Here's what we'll generate for you:
    </Typography>
    <List>
      {ANALYSIS_FEATURES.map((feature, index) => (
        <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 36, color: "#a78bfa" }}>{feature.icon}</ListItemIcon>
          <ListItemText
            primary={feature.text}
            primaryTypographyProps={{ sx: { color: "rgba(255,255,255,0.9)", fontSize: isMobile ? "0.8rem" : "0.9rem" } }}
          />
        </ListItem>
      ))}
    </List>
  </>
);

export const CreateActions: React.FC<CreateActionsProps> = ({ reset, submit, canSubmit, isSubmitting, announcement, onAnnouncementClear, error }) => {
  const [showInfo, setShowInfo] = useState(true);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  
  // Track previous isSubmitting value at component level (not inside effect)
  const prevIsSubmittingRef = useRef(isSubmitting);
  const [analysisCompleteRef, setAnalysisCompleteRef] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const timer = setTimeout(() => setShowInfo(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Close modal only AFTER analysis fully completes (wait for project/analysis to be set)
  useEffect(() => {
    // Track if analysis transitioned from true to false (completed)
    const wasSubmitting = prevIsSubmittingRef.current;
    const nowNotSubmitting = !isSubmitting;
    
    // Only close modal if:
    // 1. Modal is still shown
    // 2. analysisStarted is true  
    // 3. isSubmitting transitioned from true to false
    // 4. AND we're not showing an error
    if (showAnalysisModal && analysisStarted && wasSubmitting && nowNotSubmitting && !error) {
      // Mark analysis as complete and close after a delay
      setAnalysisCompleteRef(true);
      console.warn('[CreateActions] Analysis complete — will close modal after delay');
      setTimeout(() => {
        setShowAnalysisModal(false);
        onAnnouncementClear?.();
      }, 500);
    }
    
    // Update ref for next render
    prevIsSubmittingRef.current = isSubmitting;
    
    // If there's an error, keep modal open so user can see error message
    if (error && showAnalysisModal) {
      console.warn('[CreateActions] Error detected — keeping modal open:', error);
    }
  }, [isSubmitting, showAnalysisModal, analysisStarted, onAnnouncementClear, error]);

  // Sequential progress - increment every few seconds
  useEffect(() => {
    if (!isSubmitting || !analysisStarted) {
      setProgressIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setProgressIndex((prev) => {
        if (prev < EDUCATIONAL_MESSAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isSubmitting, analysisStarted]);

  const handleSubmitClick = () => {
    if (canSubmit && !isSubmitting) setShowAnalysisModal(true);
  };

  const handleStartAnalysis = useCallback(() => {
    setAnalysisStarted(true);
    setProgressIndex(0);
    submit();
  }, [submit]);

  const showProgressInModal = showAnalysisModal && (analysisStarted || isSubmitting);

  const buttonText = canSubmit 
    ? "Continue to Research Topic" 
    : "Provide Podcast Inputs to Continue";

  return (
    <Stack spacing={2}>
      <InfoBanner showInfo={showInfo} setShowInfo={setShowInfo} />
      {!showInfo && <ShowTipsLink onClick={() => setShowInfo(true)} />}

      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        <SecondaryButton onClick={reset} startIcon={<RefreshIcon />}>
          Reset
        </SecondaryButton>
        <PrimaryButton
          onClick={handleSubmitClick}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
          startIcon={<AutoAwesomeIcon />}
          tooltip={!canSubmit ? "Required: Podcast topic, presenter avatar, voice, duration, speakers, and podcast mode" : "Start AI analysis after this click"}
        >
          {isSubmitting ? "Analyzing..." : buttonText}
        </PrimaryButton>
      </Stack>

      <Dialog
        open={showAnalysisModal}
        disableEscapeKeyDown={isSubmitting}
        onClose={(event, reason) => {
          // Only allow closing if NOT submitting and analysis hasn't started
          // This prevents modal from closing when user clicks outside while analysis runs
          if (!isSubmitting && !analysisStarted) {
            setShowAnalysisModal(false);
          }
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { ...styles.dialog, ...(isMobile ? { borderRadius: 0 } : {}) } }}
      >
        <DialogTitle sx={{ color: "#fff", display: "flex", alignItems: "center", gap: 1, fontSize: isMobile ? "1rem" : "1.25rem" }}>
          {isSubmitting ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} sx={{ color: "#a78bfa" }} />
              Creating Your Podcast
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: "#a78bfa" }} />
              What You'll Get
            </Box>
          )}
        </DialogTitle>

        <DialogContent sx={{ ...styles.dialogContent, ...(isMobile ? { px: 2, py: 2 } : {}) }}>
          {showProgressInModal ? (
            <AnalysisProgressView currentMessage={announcement} progressIndex={progressIndex} />
          ) : error ? (
            <Stack spacing={2}>
              <Alert 
                severity="error" 
                icon={<ErrorIcon />}
                sx={{ bgcolor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca" }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ color: "#fecaca" }}>
                  Error creating project
                </Typography>
                <Typography variant="caption" sx={{ color: "#fecaca", display: "block", mt: 1 }}>
                  {error}
                </Typography>
              </Alert>
              <WhatYoullGetView isMobile={isMobile} />
            </Stack>
          ) : (
            <WhatYoullGetView isMobile={isMobile} />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, ...(isMobile ? { px: 2, pb: 2 } : {}) }}>
          {showProgressInModal ? null : (
            <>
              <SecondaryButton onClick={() => setShowAnalysisModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleStartAnalysis} startIcon={<AutoAwesomeIcon />}>
                Start Analysis
              </PrimaryButton>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
};