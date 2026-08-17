import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import HeaderControls from "../../shared/HeaderControls";
import { YT_BORDER, YT_TEXT } from "../constants";

interface YouTubeVideoCreatorHeaderProps {
  onBack: () => void;
}

export const YouTubeVideoCreatorHeader: React.FC<YouTubeVideoCreatorHeaderProps> = ({
  onBack,
}) => (
  <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
    <Button
      startIcon={<ArrowBack />}
      onClick={onBack}
      variant="outlined"
      sx={{ borderColor: YT_BORDER, color: YT_TEXT, backgroundColor: "white" }}
    >
      Back to Dashboard
    </Button>
    <Typography variant="h4" sx={{ flexGrow: 1, fontWeight: 700 }}>
      YouTube Creator Studio
    </Typography>
    <HeaderControls colorMode="light" showAlerts={true} showUser={true} />
  </Box>
);
