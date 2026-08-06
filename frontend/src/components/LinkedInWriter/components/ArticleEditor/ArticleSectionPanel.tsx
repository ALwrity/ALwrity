/**
 * Sidebar panel — navigate and rename article sections.
 */

import React from "react";
import { Box, Button, Chip, TextField, Typography } from "@mui/material";
import type { LinkedInArticleSection } from "../../utils/linkedInArticleDraftUtils";
import { createArticleSectionId } from "../../utils/linkedInArticleDraftUtils";
import { isIntroductionSection } from "../../utils/linkedInArticleIntroUtils";
import {
  articleInputSx,
  articlePanelSx,
  sectionPreviewText,
  sectionWordCount,
} from "./articleEditorStyles";

export interface ArticleSectionPanelProps {
  sections: LinkedInArticleSection[];
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  onRenameSection: (id: string, heading: string) => void;
  onAddSection: (section: LinkedInArticleSection) => void;
}

export const ArticleSectionPanel: React.FC<ArticleSectionPanelProps> = ({
  sections,
  activeSectionId,
  onSelectSection,
  onRenameSection,
  onAddSection,
}) => {
  const handleAdd = () => {
    const section = {
      id: createArticleSectionId(),
      heading: `Section ${sections.length + 1}`,
      body: "",
    };
    onAddSection(section);
    onSelectSection(section.id);
  };

  return (
    <Box
      data-testid="article-section-panel"
      sx={{
        ...articlePanelSx,
        p: 1.5,
        minWidth: { xs: "100%", md: 260 },
        maxWidth: { md: 300 },
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, color: "#1e293b", mb: 0.25 }}
      >
        Article sections
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "#64748b", display: "block", mb: 1.25, lineHeight: 1.4 }}
      >
        Click a section to edit its content in the editor on the left. The
        introduction is your opening paragraph before section headings.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {sections.map((section, index) => {
          const active = section.id === activeSectionId;
          const words = sectionWordCount(section.body);
          const isIntro = isIntroductionSection(section, index);
          const displayHeading = isIntro
            ? "Introduction"
            : section.heading.trim() || `Section ${index + 1}`;

          return (
            <Box
              key={section.id}
              component="button"
              type="button"
              onClick={() => onSelectSection(section.id)}
              data-testid={`article-section-item-${index + 1}`}
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                border: `1px solid ${active ? "#0a66c2" : "#e2e8f0"}`,
                borderRadius: 1.5,
                bgcolor: active ? "#eff6ff" : "#f8fafc",
                p: 1.25,
                transition: "border-color 0.15s, background 0.15s",
                "&:hover": {
                  borderColor: active ? "#0a66c2" : "#cbd5e1",
                  bgcolor: active ? "#eff6ff" : "#f1f5f9",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  mb: 0.75,
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    bgcolor: active ? "#0a66c2" : "#e0e7ff",
                    color: active ? "#fff" : "#4338ca",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    mt: 0.15,
                  }}
                >
                  {index + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#1e293b",
                        lineHeight: 1.3,
                      }}
                    >
                      {displayHeading}
                    </Typography>
                    {isIntro ? (
                      <Chip
                        label="Opening"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: "#e0f2fe",
                          color: "#0369a1",
                        }}
                      />
                    ) : null}
                    {active ? (
                      <Chip
                        label="Editing"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: "#0a66c2",
                          color: "#fff",
                        }}
                      />
                    ) : null}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "#64748b", display: "block", mt: 0.25 }}
                  >
                    {isIntro
                      ? words === 0
                        ? "Opening paragraph — click to write"
                        : `Opening · ${words} word${words === 1 ? "" : "s"}`
                      : words === 0
                        ? "Empty — click to add content"
                        : `${words} word${words === 1 ? "" : "s"}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#94a3b8",
                      display: "block",
                      mt: 0.5,
                      lineHeight: 1.35,
                      fontStyle: words === 0 ? "italic" : "normal",
                    }}
                  >
                    {sectionPreviewText(section.body)}
                  </Typography>
                </Box>
              </Box>

              {!isIntro ? (
                <TextField
                  size="small"
                  fullWidth
                  label="Section heading (H2)"
                  value={section.heading}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onRenameSection(section.id, e.target.value)}
                  placeholder={`Section ${index + 1} title`}
                  sx={{
                    ...articleInputSx,
                    "& .MuiInputLabel-root": { fontSize: 12, color: "#64748b" },
                    "& .MuiInputBase-input": { fontSize: 13, py: 0.75 },
                  }}
                />
              ) : (
                <Typography
                  variant="caption"
                  sx={{ color: "#94a3b8", display: "block", lineHeight: 1.35 }}
                >
                  Fixed opening — appears before your first section heading.
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      <Button
        size="small"
        variant="outlined"
        onClick={handleAdd}
        sx={{
          mt: 1.25,
          textTransform: "none",
          fontWeight: 600,
          borderColor: "#0a66c2",
          color: "#0a66c2",
        }}
      >
        + Add section
      </Button>
    </Box>
  );
};
