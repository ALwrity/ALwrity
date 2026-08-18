/* @refresh reset */
/**
 * YouTube Creator Studio shell — Video Creator pipeline (pre-#386 landing).
 * Studio Hub is not mounted in this phase.
 */
import React, { useEffect } from "react";
import { Container } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { YT_BG, YT_BORDER, YT_TEXT } from "./constants";
import { YouTubeVideoCreatorHeader } from "./panel/YouTubeVideoCreatorHeader";
import { YouTubeVideoCreatorPanel } from "./YouTubeVideoCreatorPanel";

const YouTubeCreator: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "YouTube Creator Studio | ALwrity";
  }, []);

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: 4,
        backgroundColor: YT_BG,
        color: YT_TEXT,
        minHeight: "100vh",
        borderRadius: 2,
        border: `1px solid ${YT_BORDER}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      }}
    >
      <YouTubeVideoCreatorHeader onBack={() => navigate("/dashboard")} />
      <YouTubeVideoCreatorPanel />
    </Container>
  );
};

export default YouTubeCreator;
