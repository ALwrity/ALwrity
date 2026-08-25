/**
 * Shared editor toolbar actions for post and article shells.
 */

import React, { useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import RateReviewIcon from '@mui/icons-material/RateReview';
import SaveIcon from '@mui/icons-material/Save';
import { EngagementBoosterLaunchButton } from "../dashboard/EngagementBoosterLaunchButton";

export type EditorSaveStatus = "idle" | "saving" | "saved" | "error";

export interface EditorChromeSharedProps {
  draft: string;
  onBackToDashboard: () => void;
  saveStatus: EditorSaveStatus;
  onSave: () => void;
  onOpenQualityCheck: () => void;
  researchSources?: unknown[];
  citations?: unknown[];
  searchQueries?: string[];
}

export const EditorChromeShared: React.FC<EditorChromeSharedProps> = ({
  draft,
  onBackToDashboard,
  saveStatus,
  onSave,
  onOpenQualityCheck,
  researchSources,
  citations,
  searchQueries,
}) => {
  const [researchAnchor, setResearchAnchor] = useState<HTMLElement | null>(null);
  const researchOpen = Boolean(researchAnchor);

  const hasResearch =
    (researchSources && researchSources.length > 0) ||
    (citations && citations.length > 0) ||
    (searchQueries && searchQueries.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="contained"
        onClick={onBackToDashboard}
        startIcon={<ArrowBackIcon fontSize="small" />}
        sx={{
          fontWeight: 600,
          bgcolor: "#0a66c2",
          "&:hover": { bgcolor: "#004182" },
          textTransform: "none",
          fontSize: 12.5,
          px: 1.8,
          py: 0.4,
          boxShadow: "none",
          borderRadius: 1.5,
          lineHeight: 1.6,
          minHeight: 30,
        }}
      >
        Dashboard
      </Button>

      <div style={{ flex: 1 }} />

      <Tooltip
        title={
          saveStatus === "saved"
            ? "Saved to Asset Library"
            : "Save draft to Asset Library"
        }
        arrow
      >
        <span>
          <Button
            type="button"
            variant="text"
            size="small"
            startIcon={
              saveStatus === "saving" ? (
                <CircularProgress size={16} />
              ) : saveStatus === "saved" ? (
                <CheckIcon fontSize="small" />
              ) : (
                <SaveIcon fontSize="small" />
              )
            }
            onClick={onSave}
            disabled={saveStatus === "saving" || saveStatus === "saved"}
            sx={{
              textTransform: "none",
              fontSize: 12.5,
              fontWeight: 500,
              color: "text.secondary",
              px: 1.2,
              py: 0.4,
              minWidth: "auto",
              minHeight: 30,
              borderRadius: 1.5,
              "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              "&.Mui-disabled": {
                color:
                  saveStatus === "saved" ? "success.main" : "text.disabled",
              },
            }}
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved"
                : "Save"}
          </Button>
        </span>
      </Tooltip>

      <Tooltip title="Run pre-publish quality check" arrow>
        <Button
          type="button"
          variant="text"
          size="small"
          startIcon={<RateReviewIcon fontSize="small" />}
          onClick={onOpenQualityCheck}
          disabled={!draft}
          sx={{
            textTransform: "none",
            fontSize: 12.5,
            fontWeight: 500,
            color: "text.secondary",
            px: 1.2,
            py: 0.4,
            minWidth: "auto",
            minHeight: 30,
            borderRadius: 1.5,
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          }}
        >
          Quality
        </Button>
      </Tooltip>

      <EngagementBoosterLaunchButton
        variant="toolbar"
        content={draft}
        disabled={!draft.trim()}
      />

      {hasResearch && (
        <>
          <Chip
            label="Research"
            size="small"
            onClick={(e) => setResearchAnchor(e.currentTarget)}
            sx={{
              fontWeight: 700,
              fontSize: 11,
              bgcolor: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #7dd3fc",
              cursor: "pointer",
              "&:hover": { bgcolor: "#bae6fd" },
            }}
          />
          <Popover
            open={researchOpen}
            anchorEl={researchAnchor}
            onClose={() => setResearchAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            sx={{ mt: 1 }}
            slotProps={{
              paper: { sx: { borderRadius: 2, p: 2, minWidth: 220 } },
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: "#0a66c2",
                mb: 1.5,
                fontSize: 13,
              }}
            >
              Research Data
            </Typography>
            {researchSources && researchSources.length > 0 && (
              <Chip
                label={`Sources: ${researchSources.length}`}
                size="small"
                onClick={() => {
                  setResearchAnchor(null);
                  window.dispatchEvent(
                    new CustomEvent("showResearchSourcesModal", {
                      detail: "sources",
                    }),
                  );
                }}
                sx={{
                  fontWeight: 600,
                  fontSize: 11,
                  mr: 1,
                  mb: 1,
                  bgcolor: "#f0f9ff",
                  border: "1px solid #0ea5e9",
                  color: "#0369a1",
                  "&:hover": { bgcolor: "#e0f2fe" },
                }}
              />
            )}
            {citations && citations.length > 0 && (
              <Chip
                label={`Citations: ${citations.length}`}
                size="small"
                onClick={() => {
                  setResearchAnchor(null);
                  window.dispatchEvent(
                    new CustomEvent("showCitationsModal", {
                      detail: "citations",
                    }),
                  );
                }}
                sx={{
                  fontWeight: 600,
                  fontSize: 11,
                  mr: 1,
                  mb: 1,
                  bgcolor: "#fef3c7",
                  border: "1px solid #f59e0b",
                  color: "#92400e",
                  "&:hover": { bgcolor: "#fde68a" },
                }}
              />
            )}
            {searchQueries && searchQueries.length > 0 && (
              <Chip
                label={`Queries: ${searchQueries.length}`}
                size="small"
                onClick={() => {
                  setResearchAnchor(null);
                  window.dispatchEvent(
                    new CustomEvent("showSearchQueriesModal", {
                      detail: "queries",
                    }),
                  );
                }}
                sx={{
                  fontWeight: 600,
                  fontSize: 11,
                  bgcolor: "#f3e8ff",
                  border: "1px solid #8b5cf6",
                  color: "#6b21a8",
                  "&:hover": { bgcolor: "#e9d5ff" },
                }}
              />
            )}
          </Popover>
        </>
      )}
    </>
  );
};
