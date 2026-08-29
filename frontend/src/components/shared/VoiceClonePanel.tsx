import React from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  Collapse,
  IconButton,
} from "@mui/material";
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import RestartAlt from '@mui/icons-material/RestartAlt';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import { VoiceAvatarPlaceholder } from "../OnboardingWizard/PersonalizationStep/components/VoiceAvatarPlaceholder";

export interface VoiceClonePanelProps {
  showVoiceClonePanel: boolean;
  voiceCreated: boolean;
  redoingClone: boolean;
  onTogglePanel: () => void;
  onVoiceSet: () => void;
  onCancelRedo: () => void;
  onDoneWithVoice: () => void;
}

export const VoiceClonePanel: React.FC<VoiceClonePanelProps> = ({
  showVoiceClonePanel,
  voiceCreated,
  redoingClone,
  onTogglePanel,
  onVoiceSet,
  onCancelRedo,
  onDoneWithVoice,
}) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Button
        onClick={onTogglePanel}
        startIcon={showVoiceClonePanel ? <ExpandLess /> : redoingClone ? <RestartAlt /> : <AutoAwesome />}
        endIcon={showVoiceClonePanel ? <ExpandLess /> : <ExpandMore />}
        sx={{
          py: 2,
          px: 3,
          width: "100%",
          background: showVoiceClonePanel 
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%)",
          border: showVoiceClonePanel 
            ? "1px solid rgba(102, 126, 234, 0.5)"
            : "none",
          borderRadius: 2.5,
          color: "#fff",
          fontWeight: 700,
          textTransform: "none",
          fontSize: "0.95rem",
          boxShadow: showVoiceClonePanel 
            ? "0 4px 15px rgba(102, 126, 234, 0.35)"
            : "0 4px 20px rgba(139, 92, 246, 0.4), 0 0 30px rgba(236, 72, 153, 0.2)",
          "&:hover": {
            background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #D97706 100%)",
            boxShadow: "0 6px 25px rgba(139, 92, 246, 0.5)",
            transform: "translateY(-1px)",
          },
          transition: "all 0.3s ease",
        }}
      >
        {redoingClone ? "Redo Voice Clone" : showVoiceClonePanel ? "Hide Voice Cloning" : "Create Your Voice Clone ✨"}
      </Button>

      <Collapse in={showVoiceClonePanel}>
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: "1px solid rgba(102, 126, 234, 0.2)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <VoiceAvatarPlaceholder
            domainName="Podcast"
            onVoiceSet={onVoiceSet}
          />

          {voiceCreated && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 2,
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <CheckCircle sx={{ color: "#10b981", fontSize: "1.25rem" }} />
                <Typography variant="subtitle2" sx={{ color: "#10b981", fontWeight: 700 }}>
                  {redoingClone ? "Voice Clone Updated!" : "Voice Clone Created Successfully!"}
                </Typography>
              </Stack>

              <Typography variant="body2" sx={{ color: "#475569", mb: 1.5, fontSize: "0.875rem" }}>
                {redoingClone ? "Your voice clone has been updated and will be used for your podcast." : "Your custom voice clone is ready and will be used for your podcast."}
              </Typography>

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  onClick={onCancelRedo}
                  sx={{
                    color: "#64748b",
                    "&:hover": { color: "#1e293b", background: "rgba(0,0,0,0.04)" },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={onDoneWithVoice}
                  sx={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    fontWeight: 600,
                    textTransform: "none",
                    px: 3,
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    },
                  }}
                >
                  Done
                </Button>
              </Stack>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};