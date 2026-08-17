import React from "react";
import { Alert, Paper, Step, StepLabel, Stepper } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { STEPS, YT_BORDER, YT_RED } from "../constants";

interface YouTubeVideoCreatorStepperProps {
  activeStep: number;
  success: string | null;
  error: string | null;
  onNavigate: (step: number) => void;
  onClearSuccess: () => void;
  onClearError: () => void;
}

export const YouTubeVideoCreatorStepper: React.FC<YouTubeVideoCreatorStepperProps> = ({
  activeStep,
  success,
  error,
  onNavigate,
  onClearSuccess,
  onClearError,
}) => (
  <>
    <Paper
      sx={{
        p: 3,
        mb: 4,
        backgroundColor: "white",
        border: `1px solid ${YT_BORDER}`,
      }}
    >
      <Stepper
        activeStep={activeStep}
        sx={{
          "& .MuiStepIcon-root.Mui-active": { color: YT_RED },
          "& .MuiStepIcon-root.Mui-completed": { color: YT_RED },
        }}
      >
        {STEPS.map((label, idx) => (
          <Step key={label} completed={idx < activeStep}>
            <StepLabel
              onClick={() => onNavigate(idx)}
              sx={{ cursor: "pointer", userSelect: "none" }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>

    <AnimatePresence>
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Alert severity="success" sx={{ mb: 3 }} onClose={onClearSuccess}>
            {success}
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>

    {error && (
      <Alert severity="error" sx={{ mb: 3 }} onClose={onClearError}>
        {error}
      </Alert>
    )}
  </>
);
