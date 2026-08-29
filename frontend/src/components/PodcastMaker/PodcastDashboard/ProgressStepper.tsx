import React from "react";
import { Box, Stepper, Step, StepLabel, Typography, alpha } from "@mui/material";
import PsychologyIcon from '@mui/icons-material/Psychology';
import SearchIcon from '@mui/icons-material/Search';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ProgressStepperProps {
  activeStep: number;
  completedSteps?: number[];
  onStepClick?: (stepIndex: number) => void;
}

const steps = [
  { label: "Analyze", icon: <PsychologyIcon />, description: "AI analyzes your idea" },
  { label: "Gather", icon: <SearchIcon />, description: "Gather facts and citations" },
  { label: "Write", icon: <EditNoteIcon />, description: "Edit and approve script" },
  { label: "Produce", icon: <PlayArrowIcon />, description: "Generate audio & video" },
];

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ activeStep, completedSteps = [], onStepClick }) => {
  if (activeStep < 0) return null;

  const handleStepClick = (stepIndex: number) => {
    const isCompleted = completedSteps.includes(stepIndex);
    if (isCompleted && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  return (
    <Stepper activeStep={activeStep} orientation="horizontal" sx={{ px: 1 }}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isClickable = isCompleted && onStepClick !== undefined;

        return (
          <Step key={step.label} completed={isCompleted}>
            <StepLabel
              onClick={() => handleStepClick(index)}
              sx={{
                cursor: isClickable ? "pointer" : "default",
                "&:hover": isClickable
                  ? {
                      "& .MuiStepLabel-label": {
                        color: "#667eea",
                      },
                    }
                  : {},
              }}
              StepIconComponent={({ active, completed }) => (
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: completed
                      ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      : active
                      ? alpha("#667eea", 0.15)
                      : "#e2e8f0",
                    border: active ? "2px solid #667eea" : "1px solid rgba(0,0,0,0.1)",
                    color: completed || active ? "#fff" : "#64748b",
                    transition: "all 0.2s ease",
                    ...(isClickable && {
                      cursor: "pointer",
                      "&:hover": {
                        transform: "scale(1.08)",
                        boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
                      },
                    }),
                  }}
                >
                  {completed ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : React.cloneElement(step.icon, { fontSize: "small" })}
                </Box>
              )}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>{step.label}</Typography>
            </StepLabel>
          </Step>
        );
      })}
    </Stepper>
  );
};