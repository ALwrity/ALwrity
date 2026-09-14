/**
 * Plan Your Video details — type, audience, goal, brand (unchanged fields).
 */

import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  BRAND_STYLE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  VIDEO_GOAL_OPTIONS,
  VIDEO_TYPE_CONFIGS,
  VIDEO_TYPES,
  type VideoType,
} from "../constants";
import { helperSx, labelSx, selectMenuProps, selectSx, tooltipPopperProps, tooltipSx } from "../styles";
import { SelectWithCustom } from "./SelectWithCustom";

export interface YouTubePlanDetailsFieldsProps {
  videoType?: VideoType;
  targetAudience?: string;
  videoGoal?: string;
  brandStyle?: string;
  onVideoTypeChange: (type: VideoType | "") => void;
  onTargetAudienceChange: (audience: string) => void;
  onVideoGoalChange: (goal: string) => void;
  onBrandStyleChange: (style: string) => void;
}

export const YouTubePlanDetailsFields: React.FC<YouTubePlanDetailsFieldsProps> = ({
  videoType,
  targetAudience,
  videoGoal,
  brandStyle,
  onVideoTypeChange,
  onTargetAudienceChange,
  onVideoGoalChange,
  onBrandStyleChange,
}) => {
  const [customTargetAudience, setCustomTargetAudience] = useState("");
  const [customVideoGoal, setCustomVideoGoal] = useState("");
  const [customBrandStyle, setCustomBrandStyle] = useState("");

  useEffect(() => {
    if (targetAudience && !TARGET_AUDIENCE_OPTIONS.some((opt) => opt.value === targetAudience)) {
      setCustomTargetAudience(targetAudience);
    }
  }, [targetAudience]);

  useEffect(() => {
    if (videoGoal && !VIDEO_GOAL_OPTIONS.some((opt) => opt.value === videoGoal)) {
      setCustomVideoGoal(videoGoal);
    }
  }, [videoGoal]);

  useEffect(() => {
    if (brandStyle && !BRAND_STYLE_OPTIONS.some((opt) => opt.value === brandStyle)) {
      setCustomBrandStyle(brandStyle);
    }
  }, [brandStyle]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
        <InputLabel sx={labelSx}>Video Type</InputLabel>
        <Tooltip
          title="Selecting a video type helps AI optimize the script structure, pacing, visuals, and avatar style. Each type has different best practices for engagement."
          arrow
          sx={tooltipSx}
          PopperProps={tooltipPopperProps}
        >
          <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: "#64748b" }}>
            <InfoOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <FormControl fullWidth>
        <Select
          value={videoType || ""}
          onChange={(event) => onVideoTypeChange(event.target.value as VideoType | "")}
          sx={selectSx}
          displayEmpty
          MenuProps={selectMenuProps}
        >
          <MenuItem value="">
            <em>Select video type (Recommended)</em>
          </MenuItem>
          {VIDEO_TYPES.map((type) => {
            const config = VIDEO_TYPE_CONFIGS[type];
            return (
              <MenuItem key={type} value={type}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: "#0f172a" }}>
                    {config.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.25 }}>
                    {config.description}
                  </Typography>
                </Box>
              </MenuItem>
            );
          })}
        </Select>
        <FormHelperText sx={helperSx}>
          Helps optimize plan, visuals, and avatar for better results. Highly recommended!
        </FormHelperText>
      </FormControl>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <SelectWithCustom
            label="Target Audience"
            value={targetAudience || ""}
            options={TARGET_AUDIENCE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              description: opt.description,
            }))}
            customValue={customTargetAudience}
            onSelectChange={(value) => {
              onTargetAudienceChange(value);
              if (TARGET_AUDIENCE_OPTIONS.some((opt) => opt.value === value)) {
                setCustomTargetAudience("");
              } else if (value) {
                setCustomTargetAudience(value);
              }
            }}
            onCustomChange={(value) => {
              setCustomTargetAudience(value);
              onTargetAudienceChange(value);
            }}
            tooltipText="Knowing your audience helps AI tailor the tone, pace, complexity, and visual style. Be specific: age range, interests, skill level, and what they care about."
            placeholder="Example: 'Tech-savvy professionals aged 25-40, interested in productivity tools'"
            helperText="Who is this video for? Helps tailor tone, pace, and style."
            multiline
            rows={2}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SelectWithCustom
            label="Primary Goal"
            value={videoGoal || ""}
            options={VIDEO_GOAL_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
              description: opt.description,
            }))}
            customValue={customVideoGoal}
            onSelectChange={(value) => {
              onVideoGoalChange(value);
              if (VIDEO_GOAL_OPTIONS.some((opt) => opt.value === value)) {
                setCustomVideoGoal("");
              } else if (value) {
                setCustomVideoGoal(value);
              }
            }}
            onCustomChange={(value) => {
              setCustomVideoGoal(value);
              onVideoGoalChange(value);
            }}
            tooltipText="What action should viewers take after watching? This shapes the call-to-action (CTA), content structure, and hook. Examples: Subscribe, Buy, Learn, Share, etc."
            placeholder="Example: 'Educate viewers on AI basics and drive 500 subscribers'"
            helperText="What should viewers do after watching? Shapes CTA and structure."
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <SelectWithCustom
          label="Brand Style / Visual Aesthetic"
          value={brandStyle || ""}
          options={BRAND_STYLE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
            description: opt.description,
          }))}
          customValue={customBrandStyle}
          onSelectChange={(value) => {
            onBrandStyleChange(value);
            if (BRAND_STYLE_OPTIONS.some((opt) => opt.value === value)) {
              setCustomBrandStyle("");
            } else if (value) {
              setCustomBrandStyle(value);
            }
          }}
          onCustomChange={(value) => {
            setCustomBrandStyle(value);
            onBrandStyleChange(value);
          }}
          tooltipText="The visual aesthetic influences avatar appearance, scene colors, transitions, and overall video feel. Choose a style that matches your brand identity and resonates with your target audience."
          placeholder="Example: 'Modern minimalist, tech-forward, clean with blue accents'"
          helperText="Visual style influences avatar, scenes, and overall video aesthetic."
        />
      </Box>
    </Box>
  );
};
