/**
 * Pick, edit, and add YouTube titles from planner suggestions.
 */

import React, { useState } from "react";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { PlanDetailsCard } from "./PlanDetailsCard";
import { inputSx, readableChipSx } from "../styles";

const MAX_CUSTOM_TITLES = 8;
const MAX_TITLE_CHARS = 70;

export interface PlanTitleOptimizerProps {
  titleSuggestions: string[];
  selectedTitle: string;
  disabled?: boolean;
  onChange: (next: { titleSuggestions: string[]; selectedTitle: string }) => void;
}

export const PlanTitleOptimizer: React.FC<PlanTitleOptimizerProps> = ({
  titleSuggestions,
  selectedTitle,
  disabled = false,
  onChange,
}) => {
  const [customTitle, setCustomTitle] = useState("");
  const suggestions = titleSuggestions.filter((title) => title.trim());

  const emit = (nextSuggestions: string[], nextSelected: string) => {
    try {
      onChange({
        titleSuggestions: nextSuggestions,
        selectedTitle: nextSelected,
      });
    } catch (error) {
      console.error("[PlanTitleOptimizer] Failed to update titles", {
        suggestionCount: nextSuggestions.length,
        selectedLength: nextSelected.trim().length,
        error,
      });
    }
  };

  const handleSelect = (title: string) => {
    if (disabled) return;
    emit(suggestions, title);
    console.info("[PlanTitleOptimizer] Selected title", { titleLength: title.trim().length });
  };

  const handleSelectedEdit = (value: string) => {
    emit(suggestions, value.slice(0, MAX_TITLE_CHARS));
  };

  const handleAddCustom = () => {
    const next = customTitle.trim().slice(0, MAX_TITLE_CHARS);
    if (!next) return;
    const exists = suggestions.some((title) => title.toLowerCase() === next.toLowerCase());
    if (exists) {
      emit(suggestions, next);
      setCustomTitle("");
      return;
    }
    if (suggestions.length >= MAX_CUSTOM_TITLES) {
      console.warn("[PlanTitleOptimizer] Title cap reached", { count: suggestions.length });
      return;
    }
    const nextSuggestions = [...suggestions, next];
    emit(nextSuggestions, next);
    setCustomTitle("");
    console.info("[PlanTitleOptimizer] Added custom title", { count: nextSuggestions.length });
  };

  const handleDelete = (title: string) => {
    if (disabled || suggestions.length <= 1) return;
    const nextSuggestions = suggestions.filter((item) => item !== title);
    const nextSelected = selectedTitle === title ? nextSuggestions[0] || "" : selectedTitle;
    emit(nextSuggestions, nextSelected);
    console.info("[PlanTitleOptimizer] Removed title", { count: nextSuggestions.length });
  };

  return (
    <PlanDetailsCard title="Video titles">
      <Typography variant="caption" sx={{ color: "#6b7280", display: "block", mb: 1.5 }}>
        Pick a title for this video. Build Scenes and publish will use the selected title.
      </Typography>

      {suggestions.length === 0 && disabled && (
        <Typography variant="body2" sx={{ color: "#6b7280" }}>
          No titles yet. Turn on Edit plan to add one.
        </Typography>
      )}

      {suggestions.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          {suggestions.map((title) => {
            const isSelected = title === selectedTitle;
            return (
              <Chip
                key={title}
                label={title}
                color={isSelected ? "primary" : "default"}
                variant={isSelected ? "filled" : "outlined"}
                onClick={disabled ? undefined : () => handleSelect(title)}
                onDelete={disabled || suggestions.length <= 1 ? undefined : () => handleDelete(title)}
                sx={
                  isSelected
                    ? { fontWeight: 600, maxWidth: "100%" }
                    : { ...readableChipSx, maxWidth: "100%" }
                }
              />
            );
          })}
        </Stack>
      )}

      {disabled && selectedTitle.trim() && (
        <Typography variant="body1" sx={{ color: "#111827", fontWeight: 600 }}>
          {selectedTitle}
        </Typography>
      )}

      {!disabled && (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            label={suggestions.length === 0 ? "Add a video title" : "Selected title"}
            value={selectedTitle}
            onChange={(e) => handleSelectedEdit(e.target.value)}
            inputProps={{ maxLength: MAX_TITLE_CHARS, "aria-label": "Selected video title" }}
            sx={inputSx}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add a custom title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.slice(0, MAX_TITLE_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              disabled={suggestions.length >= MAX_CUSTOM_TITLES}
              inputProps={{ maxLength: MAX_TITLE_CHARS, "aria-label": "Custom video title" }}
              sx={inputSx}
            />
            <Button
              variant="outlined"
              onClick={handleAddCustom}
              disabled={!customTitle.trim() || suggestions.length >= MAX_CUSTOM_TITLES}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              Add
            </Button>
          </Box>
        </Stack>
      )}
    </PlanDetailsCard>
  );
};
