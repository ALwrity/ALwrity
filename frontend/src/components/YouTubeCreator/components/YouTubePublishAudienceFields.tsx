/**
 * YouTube audience controls on Connect & Publish: Made for Kids and
 * Age restriction (advanced). Uses Creator labelSx/helperSx and YouTube red.
 * Disabled 18+ labels keep gray color: the global MUI theme is dark, so
 * default disabled text/radios vanish on the white Creator surface.
 */
import React, { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { YT_RED, YT_TEXT } from "../constants";
import { helperSx, labelSx } from "../styles";

export type YouTubeMadeForKidsChoice = boolean | null;

interface YouTubePublishAudienceFieldsProps {
  madeForKids: YouTubeMadeForKidsChoice;
  ageRestricted: boolean;
  onMadeForKidsChange: (madeForKids: boolean) => void;
  onAgeRestrictedChange: (ageRestricted: boolean) => void;
}

const DISABLED_LABEL = "#6b7280";
const DISABLED_RADIO = "#9ca3af";

const radioSx = {
  color: YT_TEXT,
  py: 0.25,
  "&.Mui-checked": {
    color: YT_RED,
  },
  "&.Mui-disabled": {
    color: DISABLED_RADIO,
  },
  "&.Mui-disabled.Mui-checked": {
    color: YT_RED,
  },
};

const radioLabelSx = {
  color: YT_TEXT,
  ml: 0,
  alignItems: "flex-start",
  "& .MuiFormControlLabel-label": {
    color: YT_TEXT,
    fontSize: "0.9375rem",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  "&.Mui-disabled": {
    opacity: 1,
  },
  "&.Mui-disabled .MuiFormControlLabel-label": {
    color: DISABLED_LABEL,
    opacity: 1,
  },
};

export function youtubeAgeRestrictionEnabled(
  madeForKids: YouTubeMadeForKidsChoice,
): boolean {
  return madeForKids === false;
}

export const YouTubePublishAudienceFields: React.FC<YouTubePublishAudienceFieldsProps> = ({
  madeForKids,
  ageRestricted,
  onMadeForKidsChange,
  onAgeRestrictedChange,
}) => {
  const kidsValue = madeForKids === null ? "" : madeForKids ? "yes" : "no";
  const ageRestrictionEnabled = youtubeAgeRestrictionEnabled(madeForKids);
  const [ageRestrictionOpen, setAgeRestrictionOpen] = useState(false);

  const handleKidsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const nextKids = event.target.value === "yes";
      console.info("[YouTubePublishAudienceFields] Made for Kids updated", {
        madeForKids: nextKids,
      });
      onMadeForKidsChange(nextKids);
    } catch (error) {
      console.error("[YouTubePublishAudienceFields] Made for Kids update failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
    }
  };

  const handleAgeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!ageRestrictionEnabled) {
        return;
      }
      const nextRestricted = event.target.value === "yes";
      console.info("[YouTubePublishAudienceFields] Age restriction updated", {
        ageRestricted: nextRestricted,
      });
      onAgeRestrictedChange(nextRestricted);
    } catch (error) {
      console.error("[YouTubePublishAudienceFields] Age restriction update failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
    }
  };

  return (
    <Stack spacing={2}>
      <FormControl component="fieldset" sx={{ m: 0 }}>
        <Typography component="legend" sx={{ ...labelSx, mb: 0.5 }}>
          Audience
        </Typography>
        <Typography variant="body2" sx={{ ...helperSx, mt: 0, mb: 1 }}>
          YouTube requires this for every upload. Made for kids videos cannot be age-restricted.
        </Typography>
        <RadioGroup
          name="youtube-made-for-kids"
          value={kidsValue}
          onChange={handleKidsChange}
        >
          <FormControlLabel
            value="yes"
            control={<Radio size="small" sx={radioSx} />}
            label="Yes, it's made for kids"
            sx={radioLabelSx}
          />
          <FormControlLabel
            value="no"
            control={<Radio size="small" sx={radioSx} />}
            label="No, it's not made for kids"
            sx={radioLabelSx}
          />
        </RadioGroup>
      </FormControl>

      <Accordion
        disableGutters
        elevation={0}
        expanded={ageRestrictionOpen}
        onChange={(_, expanded) => {
          try {
            console.info("[YouTubePublishAudienceFields] Age restriction toggle", {
              expanded,
            });
            setAgeRestrictionOpen(expanded);
          } catch (error) {
            console.error("[YouTubePublishAudienceFields] Age restriction toggle failed", {
              errorName: error instanceof Error ? error.name : "Error",
            });
          }
        }}
        sx={{
          backgroundColor: "transparent",
          boxShadow: "none",
          alignSelf: "flex-start",
          width: "100%",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: YT_TEXT }} />}
          sx={{
            minHeight: 40,
            px: 0,
            width: "fit-content",
            maxWidth: "100%",
            justifyContent: "flex-start",
            gap: 1,
            "& .MuiAccordionSummary-content": {
              m: 0,
              flexGrow: 0,
            },
            "& .MuiAccordionSummary-expandIconWrapper": {
              order: -1,
              color: YT_TEXT,
              mr: 1,
            },
          }}
        >
          <Typography sx={{ ...labelSx, mb: 0 }}>Age restriction (advanced)</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0.5, pb: 0 }}>
          <FormControl component="fieldset" sx={{ m: 0 }} disabled={!ageRestrictionEnabled}>
            <Typography variant="body2" sx={{ ...helperSx, mt: 0, mb: 1 }}>
              Restrict this video to viewers over 18. Available only when the video is not made for
              kids.
            </Typography>
            <RadioGroup
              name="youtube-age-restricted"
              value={ageRestricted ? "yes" : "no"}
              onChange={handleAgeChange}
            >
              <FormControlLabel
                value="yes"
                control={
                  <Radio size="small" sx={radioSx} disabled={!ageRestrictionEnabled} />
                }
                label="Yes, restrict my video to viewers over 18"
                sx={radioLabelSx}
                disabled={!ageRestrictionEnabled}
              />
              <FormControlLabel
                value="no"
                control={
                  <Radio size="small" sx={radioSx} disabled={!ageRestrictionEnabled} />
                }
                label="No, don't restrict my video to viewers over 18"
                sx={radioLabelSx}
                disabled={!ageRestrictionEnabled}
              />
            </RadioGroup>
          </FormControl>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
