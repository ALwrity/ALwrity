import React from 'react';
import { Stack, Box, Typography, Tooltip, IconButton, Chip, alpha } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { Knobs } from '../types';

interface CreateHeaderProps {
  subscription: any;
  duration: number;
  speakers: number;
  knobs: Knobs;
  estimatedCost: {
    ttsCost: number;
    avatarCost: number;
    videoCost: number;
    researchCost: number;
    total: number;
  };
}

export const CreateHeader: React.FC<CreateHeaderProps> = ({
  subscription,
  duration,
  speakers,
  knobs,
  estimatedCost,
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
        borderRadius: 3,
        p: { xs: 2, md: 2.5 },
        border: "1px solid rgba(102, 126, 234, 0.15)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            }}
          >
            <AutoAwesomeIcon sx={{ color: "#fff", fontSize: "1.25rem" }} />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography 
              variant="h6" 
              sx={{ 
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
                fontSize: { xs: "1.125rem", md: "1.25rem" },
                letterSpacing: "-0.02em",
              }}
            >
              Create New Podcast Episode
            </Typography>
            <Tooltip
              title={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Tips for best results:
                  </Typography>
                  <Typography variant="body2" component="div" sx={{ fontSize: "0.875rem" }}>
                    • Provide one clear topic OR a single blog URL (we won't auto-run anything).<br />
                    • Keep it concise—one sentence topic works best.<br />
                    • We start analysis only after you confirm, so you stay in control.
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#0f172a",
                    color: "#ffffff",
                    maxWidth: 300,
                    fontSize: "0.875rem",
                    p: 1.5,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  },
                },
                arrow: {
                  sx: {
                    color: "#0f172a",
                  },
                },
              }}
            >
              <IconButton 
                size="small" 
                sx={{ 
                  color: "#64748b", 
                  "&:hover": { 
                    color: "#667eea",
                    backgroundColor: alpha("#667eea", 0.08),
                  } 
                }}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ alignItems: "center" }}>
          <Tooltip
            title={`Your current subscription plan: ${subscription?.tier || "free"}. Upgrade for more features.`}
            arrow
            placement="top"
          >
            <Chip 
              label={`Plan: ${subscription?.tier || "free"}`} 
              size="small" 
              sx={{
                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)",
                color: "#667eea",
                fontWeight: 600,
                border: "1px solid rgba(102, 126, 234, 0.2)",
                fontSize: "0.75rem",
                height: 26,
                cursor: "help",
              }}
            />
          </Tooltip>
          <Tooltip
            title={`Podcast duration: ${duration} minutes. Maximum duration is 10 minutes. Recommended: 5-10 minutes for best results.`}
            arrow
            placement="top"
          >
            <Chip 
              label={`Duration: ${duration} min`} 
              size="small"
              sx={{
                background: alpha("#0f172a", 0.06),
                color: "#0f172a",
                fontWeight: 600,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "0.75rem",
                height: 26,
                cursor: "help",
              }}
            />
          </Tooltip>
          <Tooltip
            title={`Number of speakers: ${speakers}. Supports 1-2 speakers. Each additional speaker adds avatar generation cost.`}
            arrow
            placement="top"
          >
            <Chip 
              label={`${speakers} speaker${speakers > 1 ? "s" : ""}`} 
              size="small"
              sx={{
                background: alpha("#0f172a", 0.06),
                color: "#0f172a",
                fontWeight: 600,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "0.75rem",
                height: 26,
                cursor: "help",
              }}
            />
          </Tooltip>
          <Tooltip
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Estimated Cost Breakdown:
                </Typography>
                <Typography variant="body2" component="div" sx={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
                  • Audio Generation: ${estimatedCost.ttsCost}<br />
                  • Avatar Creation: ${estimatedCost.avatarCost}<br />
                  • Video Rendering: ${estimatedCost.videoCost}<br />
                  • Research: ${estimatedCost.researchCost}<br />
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, pt: 0.5, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                    Total: ${estimatedCost.total}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "0.75rem", opacity: 0.9, mt: 0.5, display: "block" }}>
                    Based on {duration} min, {speakers} speaker{speakers > 1 ? "s" : ""}, {knobs.bitrate === "hd" ? "HD" : "standard"} quality
                  </Typography>
                </Typography>
              </Box>
            }
            arrow
            placement="top"
            componentsProps={{
              tooltip: {
                sx: {
                  bgcolor: "#0f172a",
                  color: "#ffffff",
                  maxWidth: 280,
                  fontSize: "0.875rem",
                  p: 1.5,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                },
              },
              arrow: {
                sx: {
                  color: "#0f172a",
                },
              },
            }}
          >
            <Chip 
              icon={<AttachMoneyIcon sx={{ fontSize: "0.875rem !important" }} />}
              label={`Est. $${estimatedCost.total}`} 
              size="small"
              sx={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)",
                color: "#059669",
                fontWeight: 600,
                border: "1px solid rgba(16, 185, 129, 0.2)",
                fontSize: "0.75rem",
                height: 26,
                cursor: "help",
              }}
            />
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};
