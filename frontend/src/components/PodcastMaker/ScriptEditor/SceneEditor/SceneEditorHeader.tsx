import React from "react";
import { Box, Typography, Stack, Chip } from "@mui/material";
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { Scene } from "../../types";

interface SceneEditorHeaderProps {
  scene: Scene;
}

export const SceneEditorHeader: React.FC<SceneEditorHeaderProps> = ({ scene }) => {
  return (
    <>
      <Typography
        variant="h6"
        sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, color: "#0f172a", fontWeight: 600 }}
      >
        <EditNoteIcon fontSize="small" sx={{ color: "#667eea", fontSize: "1.5rem" }} />
        {scene.title}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Chip
          icon={scene.approved ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          label={scene.approved ? "Approved" : "Pending Approval"}
          size="small"
          color={scene.approved ? "success" : "warning"}
          sx={{
            background: scene.approved
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)"
              : "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.12) 100%)",
            color: scene.approved ? "#059669" : "#d97706",
            border: scene.approved
              ? "1px solid rgba(16, 185, 129, 0.25)"
              : "1px solid rgba(245, 158, 11, 0.25)",
            fontWeight: 600,
            fontSize: "0.75rem",
            height: 26,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        />
        <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500, fontSize: "0.8125rem" }}>
          Duration: {scene.duration}s
        </Typography>
      </Stack>
    </>
  );
};
