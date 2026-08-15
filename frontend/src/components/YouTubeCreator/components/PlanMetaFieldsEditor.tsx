/**
 * Edit remaining Plan Details fields (audience, goal, CTA, style, keywords).
 */

import React, { useState } from "react";
import { Box, Button, Chip, Grid, Stack, TextField } from "@mui/material";
import { PlanDetailsCard } from "./PlanDetailsCard";
import { inputSx, readableChipSx } from "../styles";
import { normalizeKeywordList } from "../utils/planOutlineHelpers";

const MAX_KEYWORDS = 12;

export interface PlanMetaFields {
  target_audience: string;
  video_goal: string;
  key_message: string;
  call_to_action: string;
  visual_style: string;
  tone: string;
  seo_keywords: string[];
}

interface PlanMetaFieldsEditorProps {
  value: PlanMetaFields;
  onChange: (next: PlanMetaFields) => void;
}

export const PlanMetaFieldsEditor: React.FC<PlanMetaFieldsEditorProps> = ({
  value,
  onChange,
}) => {
  const [keywordDraft, setKeywordDraft] = useState("");
  const keywords = normalizeKeywordList(value.seo_keywords, MAX_KEYWORDS);

  const patch = (updates: Partial<PlanMetaFields>) => {
    try {
      onChange({ ...value, ...updates });
    } catch (error) {
      console.error("[PlanMetaFieldsEditor] Failed to update plan fields", {
        updatedKeys: Object.keys(updates),
        error,
      });
    }
  };

  const handleAddKeyword = () => {
    const next = keywordDraft.trim();
    if (!next) return;
    const merged = normalizeKeywordList([...keywords, next], MAX_KEYWORDS);
    if (merged.length === keywords.length && keywords.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setKeywordDraft("");
      return;
    }
    if (keywords.length >= MAX_KEYWORDS) {
      console.warn("[PlanMetaFieldsEditor] Keyword cap reached", { count: keywords.length });
      return;
    }
    patch({ seo_keywords: merged });
    setKeywordDraft("");
    console.info("[PlanMetaFieldsEditor] Added keyword", { count: merged.length });
  };

  const handleDeleteKeyword = (keyword: string) => {
    const next = keywords.filter((item) => item !== keyword);
    patch({ seo_keywords: next });
    console.info("[PlanMetaFieldsEditor] Removed keyword", { count: next.length });
  };

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Target Audience" fullHeight>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={value.target_audience}
              onChange={(e) => patch({ target_audience: e.target.value })}
              inputProps={{ "aria-label": "Target audience" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Goal" fullHeight>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={value.video_goal}
              onChange={(e) => patch({ video_goal: e.target.value })}
              inputProps={{ "aria-label": "Video goal" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Key Message" fullHeight>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={value.key_message}
              onChange={(e) => patch({ key_message: e.target.value })}
              inputProps={{ "aria-label": "Key message" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Call to Action" fullHeight>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={value.call_to_action}
              onChange={(e) => patch({ call_to_action: e.target.value })}
              inputProps={{ "aria-label": "Call to action" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Visual Style" fullHeight>
            <TextField
              fullWidth
              value={value.visual_style}
              onChange={(e) => patch({ visual_style: e.target.value })}
              inputProps={{ "aria-label": "Visual style" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <PlanDetailsCard title="Tone" fullHeight>
            <TextField
              fullWidth
              value={value.tone}
              onChange={(e) => patch({ tone: e.target.value })}
              inputProps={{ "aria-label": "Tone" }}
              sx={inputSx}
            />
          </PlanDetailsCard>
        </Grid>
      </Grid>

      <PlanDetailsCard title="SEO Keywords">
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          {keywords.map((keyword) => (
            <Chip
              key={keyword}
              label={keyword}
              onDelete={() => handleDeleteKeyword(keyword)}
              sx={readableChipSx}
            />
          ))}
        </Stack>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add a keyword"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            disabled={keywords.length >= MAX_KEYWORDS}
            inputProps={{ "aria-label": "New SEO keyword" }}
            sx={inputSx}
          />
          <Button
            variant="outlined"
            onClick={handleAddKeyword}
            disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Add keyword
          </Button>
        </Box>
      </PlanDetailsCard>
    </>
  );
};
