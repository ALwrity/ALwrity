/**
 * Device chrome wrapper for LinkedIn feed live preview (desktop vs mobile).
 */
import React from "react";
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import ComputerIcon from "@mui/icons-material/Computer";
import type { LinkedInFeedDevice } from "../utils/linkedInFeedPreviewUtils";
import { getFeedFrameWidth } from "../utils/linkedInFeedPreviewUtils";

interface LinkedInFeedPreviewFrameProps {
  device: LinkedInFeedDevice;
  onDeviceChange: (device: LinkedInFeedDevice) => void;
  children: React.ReactNode;
}

export const LinkedInFeedPreviewFrame: React.FC<LinkedInFeedPreviewFrameProps> = ({
  device,
  onDeviceChange,
  children,
}) => {
  const frameWidth = getFeedFrameWidth(device);
  const isMobile = device === "mobile";

  const deviceToggleSx = (selected: boolean) => ({
    textTransform: "none" as const,
    px: 1.25,
    py: 0.4,
    gap: 0.5,
    fontSize: 12,
    fontWeight: 600,
    color: selected ? "#0a66c2" : "#64748b",
    bgcolor: selected ? "#fff" : "transparent",
    boxShadow: selected ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
    "&:hover": {
      bgcolor: selected ? "#fff" : "#e2e8f0",
    },
    "&.Mui-selected": {
      color: "#0a66c2",
      bgcolor: "#fff",
      "&:hover": { bgcolor: "#fff" },
    },
    "& .MuiSvgIcon-root": {
      color: "inherit",
    },
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
          Feed preview — how your post appears before “see more”
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={device}
          onChange={(_, next: LinkedInFeedDevice | null) => {
            if (next) onDeviceChange(next);
          }}
          aria-label="Feed device"
          sx={{
            bgcolor: "#f1f5f9",
            borderRadius: 2,
            p: 0.3,
            gap: 0.3,
            "& .MuiToggleButtonGroup-grouped": {
              border: "none",
              borderRadius: 1.5,
              mx: 0,
            },
          }}
        >
          <ToggleButton value="desktop" sx={deviceToggleSx(device === "desktop")}>
            <ComputerIcon sx={{ fontSize: 16 }} />
            Desktop
          </ToggleButton>
          <ToggleButton value="mobile" sx={deviceToggleSx(device === "mobile")}>
            <SmartphoneIcon sx={{ fontSize: 16 }} />
            Mobile
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        sx={{
          mx: "auto",
          width: "100%",
          maxWidth: frameWidth,
          transition: "max-width 0.2s ease",
        }}
      >
        <Box
          sx={{
            border: isMobile ? "10px solid #1e293b" : "1px solid #cbd5e1",
            borderRadius: isMobile ? 3 : 2,
            overflow: "hidden",
            bgcolor: "#fff",
            boxShadow: isMobile
              ? "0 12px 32px rgba(15, 23, 42, 0.18)"
              : "0 4px 16px rgba(15, 23, 42, 0.08)",
          }}
        >
          {isMobile && (
            <Box
              sx={{
                height: 22,
                bgcolor: "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 4,
                  borderRadius: 999,
                  bgcolor: "rgba(255,255,255,0.35)",
                }}
              />
            </Box>
          )}
          <Box
            sx={{
              bgcolor: "#f3f2ef",
              minHeight: isMobile ? 320 : 280,
              p: isMobile ? 1.25 : 1.5,
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
