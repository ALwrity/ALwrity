/**
 * Hub-themed three-choice modal after Enhance Topic with AI.
 */

import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { YT_RED } from "../constants";
import { helperSx, inputSx, paperSx } from "../styles";

export interface YouTubePlanEnhanceChoicesModalProps {
  open: boolean;
  enhancedIdeas: string[];
  rationales: string[];
  onClose: () => void;
  onSelectChoice: (idea: string) => void;
}

export const YouTubePlanEnhanceChoicesModal: React.FC<YouTubePlanEnhanceChoicesModalProps> = ({
  open,
  enhancedIdeas,
  rationales,
  onClose,
  onSelectChoice,
}) => {
  const [drafts, setDrafts] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    const next = [0, 1, 2].map((index) =>
      typeof enhancedIdeas[index] === "string" ? enhancedIdeas[index] : "",
    );
    setDrafts(next);
  }, [enhancedIdeas, open]);

  const handleSelect = (index: number) => {
    const chosen = (drafts[index] || "").trim();
    if (!chosen) {
      console.warn("[YouTubePlan] Enhance choice skipped: empty draft", { index });
      return;
    }
    try {
      console.info("[YouTubePlan] Enhance choice selected", { index, ideaLen: chosen.length });
      onSelectChoice(chosen);
    } catch (error) {
      console.error("[YouTubePlan] Enhance choice select failed", { index, error });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { ...paperSx, borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
          color: "#0f0f0f",
          fontWeight: 700,
        }}
      >
        Choose an enhanced topic
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "#6b7280", mb: 2 }}>
          Pick one option to replace your idea. You can edit it first. Generate Pitch is still a separate step.
        </Typography>
        <Stack spacing={2}>
          {drafts.map((draft, index) => (
            <Stack
              key={`enhance-choice-${index}`}
              spacing={1}
              sx={{ border: "1px solid #e5e5e5", borderRadius: 2, p: 1.5 }}
            >
              {rationales[index] ? (
                <Typography variant="caption" sx={{ color: "#6b7280" }}>
                  {rationales[index]}
                </Typography>
              ) : null}
              <TextField
                value={draft}
                onChange={(event) => {
                  const next = [...drafts];
                  next[index] = event.target.value;
                  setDrafts(next);
                }}
                multiline
                minRows={2}
                fullWidth
                sx={inputSx}
                FormHelperTextProps={{ sx: helperSx }}
              />
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => handleSelect(index)}
                sx={{ textTransform: "none", fontWeight: 600, alignSelf: "flex-start", bgcolor: YT_RED }}
              >
                Use this topic
              </Button>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none", color: "#0f0f0f" }}>
          Keep original
        </Button>
      </DialogActions>
    </Dialog>
  );
};
