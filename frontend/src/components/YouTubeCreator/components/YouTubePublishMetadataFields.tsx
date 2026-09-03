/**
 * Editable YouTube publish fields shown on the Render step.
 * Uses Creator inputSx/labelSx so fields stay readable on the white surface
 * under the global dark MUI theme.
 */
import React, { useEffect, useRef, useState } from "react";
import { Paper, Stack, TextField, Typography } from "@mui/material";
import { YT_BG, YT_TEXT } from "../constants";
import { helperSx, inputSx, labelSx, paperSx, sectionTitleSx } from "../styles";
import {
  parseYouTubePublishTags,
  YOUTUBE_PUBLISH_CATEGORIES,
  type YouTubePublishMetadata,
} from "./youtubePublishMetadata";

interface YouTubePublishMetadataFieldsProps {
  metadata: YouTubePublishMetadata;
  onMetadataChange: (next: YouTubePublishMetadata) => void;
}

const fieldSx = {
  ...inputSx,
  "& .MuiNativeSelect-select": {
    color: YT_TEXT,
    backgroundColor: YT_BG,
  },
  "& option": {
    color: YT_TEXT,
    backgroundColor: YT_BG,
  },
};

export const YouTubePublishMetadataFields: React.FC<YouTubePublishMetadataFieldsProps> = ({
  metadata,
  onMetadataChange,
}) => {
  const [tagsDraft, setTagsDraft] = useState(() => metadata.tags.join(", "));
  const tagsFocusedRef = useRef(false);

  useEffect(() => {
    if (tagsFocusedRef.current) {
      return;
    }
    try {
      setTagsDraft(metadata.tags.join(", "));
    } catch (error) {
      console.error("[YouTubePublishMetadataFields] Tags draft sync failed", {
        errorName: error instanceof Error ? error.name : "Error",
        tagCount: metadata.tags.length,
      });
    }
  }, [metadata.tags]);

  const patch = (updates: Partial<YouTubePublishMetadata>) => {
    try {
      onMetadataChange({ ...metadata, ...updates });
    } catch (error) {
      console.error("[YouTubePublishMetadataFields] Update failed", {
        errorName: error instanceof Error ? error.name : "Error",
        updatedKeys: Object.keys(updates),
      });
    }
  };

  return (
    <Paper elevation={0} sx={{ ...paperSx, p: 3, mt: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2" sx={{ ...sectionTitleSx, mb: 0 }}>
          YouTube details
        </Typography>
        <Typography variant="body2" sx={{ ...helperSx, mt: 0 }}>
          These details are sent when you Publish to YouTube.
        </Typography>
        <TextField
          label="Title"
          value={metadata.title}
          onChange={(event) => patch({ title: event.target.value })}
          inputProps={{ "aria-label": "Title" }}
          InputLabelProps={{ sx: labelSx }}
          sx={fieldSx}
          fullWidth
        />
        <TextField
          label="Description"
          value={metadata.description}
          onChange={(event) => patch({ description: event.target.value })}
          inputProps={{ "aria-label": "Description" }}
          InputLabelProps={{ sx: labelSx }}
          sx={fieldSx}
          fullWidth
          multiline
          minRows={3}
        />
        <TextField
          label="Tags"
          value={tagsDraft}
          onFocus={() => {
            tagsFocusedRef.current = true;
          }}
          onBlur={() => {
            try {
              tagsFocusedRef.current = false;
              setTagsDraft(metadata.tags.join(", "));
              console.info("[YouTubePublishMetadataFields] Tags draft committed", {
                tagCount: metadata.tags.length,
              });
            } catch (error) {
              console.error("[YouTubePublishMetadataFields] Tags blur failed", {
                errorName: error instanceof Error ? error.name : "Error",
              });
            }
          }}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setTagsDraft(nextDraft);
            try {
              patch({ tags: parseYouTubePublishTags(nextDraft) });
            } catch (error) {
              console.error("[YouTubePublishMetadataFields] Tags parse failed", {
                errorName: error instanceof Error ? error.name : "Error",
                draftLength: nextDraft.length,
              });
            }
          }}
          inputProps={{ "aria-label": "Tags" }}
          InputLabelProps={{ sx: labelSx }}
          sx={fieldSx}
          fullWidth
        />
        <TextField
          select
          label="Category"
          value={metadata.category_id}
          onChange={(event) => {
            const categoryId = event.target.value;
            console.info("[YouTubePublishMetadataFields] Category updated", { categoryId });
            patch({ category_id: categoryId });
          }}
          inputProps={{ "aria-label": "Category" }}
          InputLabelProps={{ sx: labelSx }}
          SelectProps={{ native: true }}
          sx={fieldSx}
          fullWidth
        >
          {YOUTUBE_PUBLISH_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </TextField>
      </Stack>
    </Paper>
  );
};
