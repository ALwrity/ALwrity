/**
 * YouTube Plan brainstorm accordion — idea cards from seed + Channel Bible.
 * Self-contained fetch via useYouTubePlanBrainstorm. Does not auto-run Generate Plan.
 */

import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import { hasChannelBibleIdentity } from "../utils/channelBibleContext";
import { useYouTubePlanBrainstorm } from "../hooks/useYouTubePlanBrainstorm";
import { PlanBrainstormLoadingPanel } from "./PlanBrainstormLoadingPanel";
import { helperSx, inputSx, labelSx } from "../styles";

const SOURCE_CHIPS = [
  {
    id: "channel_bible" as const,
    label: "Channel Bible",
    color: "#2563eb",
    Icon: MenuBookOutlinedIcon,
  },
  {
    id: "web_research" as const,
    label: "Web research",
    color: "#667eea",
    Icon: TravelExploreOutlinedIcon,
  },
  {
    id: "repurpose" as const,
    label: "Repurpose",
    color: "#10b981",
    Icon: ReplayOutlinedIcon,
  },
];

function sourceChipSx(color: string, active: boolean, disabledChip = false) {
  return {
    background: active ? `${color}26` : `${color}14`,
    color: disabledChip ? "#9ca3af" : color,
    border: `1px solid ${active ? color : `${color}66`}`,
    fontWeight: 600,
    fontSize: "0.8125rem",
    "& .MuiChip-icon": {
      color: disabledChip ? "#9ca3af" : color,
    },
    "&:hover": disabledChip
      ? {}
      : {
          background: `${color}33`,
        },
  };
}

export interface PlanBrainstormPanelProps {
  userIdea: string;
  channelBible: YouTubeChannelBible | null;
  onUseIdea: (prompt: string) => void;
  disabled?: boolean;
}

export const PlanBrainstormPanel: React.FC<PlanBrainstormPanelProps> = ({
  userIdea,
  channelBible,
  onUseIdea,
  disabled = false,
}) => {
  const niche = (channelBible?.niche || "").trim();
  const [hasUserEditedSeed, setHasUserEditedSeed] = useState(false);
  const [seed, setSeed] = useState(() => userIdea.trim() || niche);
  const [useChannelBible, setUseChannelBible] = useState(() => hasChannelBibleIdentity(channelBible));
  const [showSaved, setShowSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const {
    phase,
    ideas,
    sources,
    seedError,
    saveError,
    savingIndex,
    savedPromptHashes,
    savedIdeas,
    savedLoading,
    savedListError,
    isUsingCache,
    loaderMessageIndex,
    run,
    save,
    loadSaved,
    hashPrompt,
  } = useYouTubePlanBrainstorm({ channelBible, useChannelBible });

  // Prefill seed from idea/niche only until the user edits the field manually.
  useEffect(() => {
    if (hasUserEditedSeed) return;
    const preferred = userIdea.trim() || niche;
    setSeed(preferred);
  }, [hasUserEditedSeed, userIdea, niche]);

  useEffect(() => {
    if (hasChannelBibleIdentity(channelBible)) {
      setUseChannelBible(true);
    }
  }, [channelBible]);

  const loading = phase === "loading";
  const canGenerate = !disabled && !loading && Boolean((seed.trim() || niche));

  const handleSeedChange = (value: string) => {
    setHasUserEditedSeed(true);
    setSeed(value);
  };

  const handleGenerate = () => {
    void run(seed);
  };

  const handleToggleSaved = () => {
    const next = !showSaved;
    setShowSaved(next);
    if (next) {
      void loadSaved();
    }
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      disableGutters
      sx={{
        mt: 1.5,
        border: "1px solid #e5e7eb",
        borderRadius: "8px !important",
        boxShadow: "none",
        "&:before": { display: "none" },
        bgcolor: "#fafafa",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5, minHeight: 48 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LightbulbOutlinedIcon sx={{ color: "#f59e0b", fontSize: 20 }} />
          <Box>
            <Typography sx={{ ...labelSx, mb: 0, fontWeight: 600 }}>
              Brainstorm video ideas
            </Typography>
            <Typography variant="caption" sx={{ color: "#6b7280" }}>
              Not sure what to film? Brainstorm ideas from your topic and Channel Bible.
            </Typography>
          </Box>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Topic seed"
            placeholder="Example: 'Budget travel for first-time visitors to Japan'"
            value={seed}
            onChange={(e) => handleSeedChange(e.target.value)}
            disabled={disabled || loading}
            fullWidth
            multiline
            minRows={2}
            helperText={
              hasUserEditedSeed
                ? "Enter a seed, or leave empty to use your Channel Bible niche when generating."
                : niche && !userIdea.trim()
                  ? `Prefilled from Channel Bible niche. You can edit or clear this field.`
                  : "Enter a seed, or leave empty to use your Channel Bible niche."
            }
            sx={inputSx}
            FormHelperTextProps={{ sx: helperSx }}
            InputLabelProps={{ sx: labelSx }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {SOURCE_CHIPS.map((chip) => {
              const ChipIcon = chip.Icon;
              if (chip.id === "channel_bible") {
                const bibleDisabled =
                  disabled || loading || !hasChannelBibleIdentity(channelBible);
                return (
                  <Chip
                    key={chip.id}
                    icon={<ChipIcon sx={{ fontSize: "0.875rem !important" }} />}
                    label={chip.label}
                    onClick={() => setUseChannelBible((v) => !v)}
                    disabled={bibleDisabled}
                    size="small"
                    sx={sourceChipSx(chip.color, useChannelBible, bibleDisabled)}
                  />
                );
              }
              if (chip.id === "web_research") {
                return (
                  <Chip
                    key={chip.id}
                    icon={<ChipIcon sx={{ fontSize: "0.875rem !important" }} />}
                    label={chip.label}
                    size="small"
                    sx={sourceChipSx(chip.color, true)}
                    title="Web research via Exa is always used when generating ideas"
                  />
                );
              }
              return (
                <Chip
                  key={chip.id}
                  icon={<ChipIcon sx={{ fontSize: "0.875rem !important" }} />}
                  label={chip.label}
                  onClick={handleToggleSaved}
                  disabled={disabled || loading}
                  size="small"
                  sx={sourceChipSx(chip.color, showSaved, disabled || loading)}
                />
              );
            })}
          </Stack>

          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleGenerate}
              disabled={!canGenerate}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ textTransform: "none", bgcolor: "#ff0000", "&:hover": { bgcolor: "#cc0000" } }}
            >
              {loading ? "Generating ideas..." : "Generate ideas"}
            </Button>
            {isUsingCache ? (
              <Typography variant="caption" sx={{ ml: 1, color: "#6b7280" }}>
                Showing cached ideas
              </Typography>
            ) : null}
          </Box>

          {loading ? <PlanBrainstormLoadingPanel loaderMessageIndex={loaderMessageIndex} /> : null}

          {seedError ? <Alert severity="error">{seedError}</Alert> : null}
          {saveError ? <Alert severity="warning">{saveError}</Alert> : null}

          {ideas.length > 0 ? (
            <Stack spacing={1}>
              {ideas.map((idea, idx) => {
                const alreadySaved = savedPromptHashes.has(hashPrompt(idea.prompt || ""));
                return (
                  <Box
                    key={`${idea.prompt}-${idx}`}
                    sx={{
                      p: 1.25,
                      border: "1px solid #e5e7eb",
                      borderRadius: 1.5,
                      bgcolor: "#fff",
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: "#111827", mb: 0.5 }}>
                      {idea.prompt}
                    </Typography>
                    {idea.rationale ? (
                      <Typography variant="body2" sx={{ color: "#4b5563", mb: 0.5 }}>
                        {idea.rationale}
                      </Typography>
                    ) : null}
                    {idea.evidence ? (
                      <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 0.75 }}>
                        {idea.evidence}
                      </Typography>
                    ) : null}
                    {sources.length > 0 ? (
                      <Stack spacing={0.25} sx={{ mb: 1 }}>
                        {sources.slice(0, 3).map((src) => (
                          <Link
                            key={src.url}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="caption"
                            underline="hover"
                          >
                            {src.title || src.url}
                          </Link>
                        ))}
                      </Stack>
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onUseIdea(idea.prompt)}
                        disabled={disabled || !idea.prompt?.trim()}
                        sx={{ textTransform: "none" }}
                      >
                        Use this idea
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => void save(idx)}
                        disabled={disabled || alreadySaved || savingIndex === idx}
                        sx={{ textTransform: "none" }}
                      >
                        {savingIndex === idx ? "Saving..." : alreadySaved ? "Saved" : "Save"}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : null}

          {showSaved ? (
            <Box sx={{ borderTop: "1px dashed #e5e7eb", pt: 1.25 }}>
              <Typography sx={{ ...labelSx, mb: 0.75 }}>Saved video ideas</Typography>
              {savedLoading ? (
                <CircularProgress size={18} />
              ) : savedListError ? (
                <Alert severity="error">{savedListError}</Alert>
              ) : savedIdeas.length === 0 ? (
                <Typography variant="body2" sx={{ color: "#6b7280" }}>
                  No saved YouTube ideas yet.
                </Typography>
              ) : (
                <Stack spacing={0.75}>
                  {savedIdeas.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: "#fff",
                        border: "1px solid #f3f4f6",
                      }}
                    >
                      <Typography variant="body2" sx={{ color: "#111827" }}>
                        {item.prompt}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => onUseIdea(item.prompt)}
                        disabled={disabled}
                        sx={{ textTransform: "none", flexShrink: 0 }}
                      >
                        Use
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
