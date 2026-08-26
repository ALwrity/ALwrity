import React, { useState } from "react";
import { Stack, Typography, Box, IconButton, Menu, MenuItem, Divider, ListItemIcon, ListItemText, Collapse, Chip, Popover, ButtonBase, useMediaQuery } from "@mui/material";
import MicIcon from '@mui/icons-material/Mic';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import FolderIcon from '@mui/icons-material/Folder';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { PodcastCostEst } from "../types";
import HeaderControls from "../../shared/HeaderControls";
import { ProgressStepper } from "./ProgressStepper";

interface HeaderProps {
  onShowProjects: () => void;
  onNewEpisode: () => void;
  activeStep?: number;
  completedSteps?: number[];
  onStepClick?: (stepIndex: number) => void;
  costEst?: PodcastCostEst | null;
}

const COST_PHASE_ORDER: PodcastCostEst["breakdown"][number]["phase"][] = ["Analyze", "Gather", "Write", "Produce"];

export const Header: React.FC<HeaderProps> = ({ onShowProjects, onNewEpisode, activeStep = -1, completedSteps = [], onStepClick, costEst }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [costAnchorEl, setCostAnchorEl] = useState<null | HTMLElement>(null);
  const [isMobileCostOpen, setIsMobileCostOpen] = useState(false);
  const isMenuOpen = Boolean(anchorEl);
  const isCostOpen = Boolean(costAnchorEl);
  const costTriggerId = "podcast-cost-est-trigger";
  const costBreakdownId = "podcast-cost-est-breakdown";

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleHelp = () => {
    handleMenuClose();
    window.open("/docs", "_blank");
  };

  const handleMyEpisodes = () => {
    handleMenuClose();
    navigate("/asset-library?source_module=podcast_maker&asset_type=audio");
  };

  const handleMyProjects = () => {
    handleMenuClose();
    onShowProjects();
  };

  const handleNewEpisode = () => {
    handleMenuClose();
    onNewEpisode();
  };

  const handleCostToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (!costEst) return;
    if (isMobile) {
      setIsMobileCostOpen((prev) => !prev);
      return;
    }
    setCostAnchorEl((prev) => (prev ? null : event.currentTarget));
  };

  const handleCostKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!costEst) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isMobile) {
        setIsMobileCostOpen((prev) => !prev);
      } else {
        setCostAnchorEl((prev) => (prev ? null : event.currentTarget));
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCostAnchorEl(null);
      setIsMobileCostOpen(false);
    }
  };

  const handleCloseCostPopover = () => {
    setCostAnchorEl(null);
  };

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
        borderRadius: 3,
        p: { xs: 1.5, md: 2.5 },
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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
      >
        {/* Logo and Title */}
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: { xs: 36, md: 44 },
              height: { xs: 36, md: 44 },
              borderRadius: 2,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            }}
          >
            <MicIcon sx={{ color: "#fff", fontSize: { xs: 20, md: 24 } }} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 700,
              fontSize: { xs: "1.1rem", sm: "1.25rem", md: "1.5rem" },
              letterSpacing: "-0.02em",
            }}
          >
            Podcast Creator
          </Typography>
        </Stack>

        {/* Right side - Hamburger Menu + HeaderControls + Create */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          {costEst && (
            <ButtonBase
              id={costTriggerId}
              onClick={handleCostToggle}
              onKeyDown={handleCostKeyDown}
              aria-label={`Cost Est total ${costEst.total.toFixed(2)} dollars. ${isMobile ? "Press to expand cost breakdown." : "Press to open cost breakdown."}`}
              aria-describedby={costBreakdownId}
              aria-expanded={isMobile ? isMobileCostOpen : isCostOpen}
              sx={{ borderRadius: 999 }}
            >
              <Chip
                icon={<AttachMoneyIcon sx={{ fontSize: "0.95rem !important" }} />}
                label={`Cost Est $${costEst.total.toFixed(2)}`}
                size="small"
                sx={{
                  cursor: "pointer",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#92400e",
                  fontWeight: 700,
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  "& .MuiChip-label": {
                    px: 1.2,
                  },
                }}
              />
            </ButtonBase>
          )}

          {/* Header Controls (alerts + user) */}
          <HeaderControls colorMode="light" showAlerts={true} showUser={true} />

          {/* Hamburger Menu Button */}
          <IconButton
            onClick={handleMenuOpen}
            sx={{
              background: isMenuOpen 
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "rgba(102, 126, 234, 0.1)",
              border: "1px solid",
              borderColor: isMenuOpen ? "transparent" : "rgba(102, 126, 234, 0.3)",
              borderRadius: 2,
              p: 1,
              transition: "all 0.2s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderColor: "transparent",
                transform: "scale(1.05)",
              },
            }}
          >
            {isMenuOpen ? (
              <CloseIcon sx={{ color: "#fff", fontSize: 20 }} />
            ) : (
              <MenuIcon sx={{ color: "#667eea", fontSize: 20 }} />
            )}
          </IconButton>

          {/* Dropdown Menu */}
          <Menu
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 220,
                borderRadius: 2,
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                border: "1px solid rgba(102, 126, 234, 0.3)",
                boxShadow: "0 10px 40px rgba(102, 126, 234, 0.25)",
                "& .MuiMenuItem-root": {
                  color: "rgba(255, 255, 255, 0.85)",
                  px: 2,
                  py: 1.5,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    background: "linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)",
                    color: "#fff",
                  },
                },
                "& .MuiListItemIcon-root": {
                  color: "#a78bfa",
                  minWidth: 36,
                },
                "& .MuiDivider-root": {
                  borderColor: "rgba(102, 126, 234, 0.2)",
                  my: 0.5,
                },
              },
            }}
          >
            <MenuItem onClick={handleNewEpisode}>
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="New Episode" 
                primaryTypographyProps={{ fontWeight: 600 }}
              />
            </MenuItem>

            <MenuItem onClick={handleMyProjects}>
              <ListItemIcon>
                <FolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="My Projects"
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </MenuItem>

            <MenuItem onClick={handleMyEpisodes}>
              <ListItemIcon>
                <LibraryMusicIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="My Episodes"
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleHelp}>
              <ListItemIcon>
                <HelpIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Help & Docs"
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {costEst && (
        <>
          <Popover
            open={!isMobile && isCostOpen}
            anchorEl={costAnchorEl}
            onClose={handleCloseCostPopover}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{
              id: costBreakdownId,
              sx: {
                mt: 1,
                p: 1.5,
                minWidth: 220,
                borderRadius: 2,
                border: "1px solid rgba(245, 158, 11, 0.25)",
                background: "#fffbeb",
              },
            }}
          >
            <Stack spacing={1}>
              {COST_PHASE_ORDER.map((phase) => {
                const phaseCost = costEst.breakdown.find((item) => item.phase === phase)?.cost || 0;
                return (
                  <Stack key={phase} direction="row" justifyContent="space-between" gap={2}>
                    <Typography variant="body2" sx={{ color: "#78350f", fontWeight: 600 }}>
                      {phase}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#92400e", fontWeight: 700 }}>
                      ${phaseCost.toFixed(2)}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Popover>

          <Collapse in={isMobile && isMobileCostOpen} timeout={250}>
            <Box
              id={costBreakdownId}
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 2,
                border: "1px solid rgba(245, 158, 11, 0.2)",
                bgcolor: "#fffbeb",
              }}
            >
              <Stack spacing={0.75}>
                {COST_PHASE_ORDER.map((phase) => {
                  const phaseCost = costEst.breakdown.find((item) => item.phase === phase)?.cost || 0;
                  return (
                    <Stack key={phase} direction="row" justifyContent="space-between" gap={2}>
                      <Typography variant="body2" sx={{ color: "#78350f", fontWeight: 600 }}>
                        {phase}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#92400e", fontWeight: 700 }}>
                        ${phaseCost.toFixed(2)}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          </Collapse>
        </>
      )}

      {/* Progress Stepper - integrated into header when active */}
      <Collapse in={activeStep >= 0} timeout={400}>
        <Box sx={{ mt: 1.5 }}>
          <ProgressStepper
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepClick={onStepClick}
          />
        </Box>
      </Collapse>
    </Box>
  );
};
