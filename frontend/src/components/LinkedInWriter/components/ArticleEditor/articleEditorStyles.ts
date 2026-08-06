/**
 * Shared LinkedIn Studio styling for the structured article editor.
 * Matches post editor contrast: dark text on white inputs, light chrome.
 */

/** MUI TextField sx for readable article inputs on studio background. */
export const articleInputSx = {
  "& .MuiInputBase-root": {
    bgcolor: "#ffffff",
    color: "#1e293b",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    lineHeight: 1.6,
  },
  "& .MuiInputBase-input": {
    color: "#1e293b",
    WebkitTextFillColor: "#1e293b",
  },
  "& .MuiInputBase-input::placeholder": {
    color: "#64748b",
    opacity: 1,
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#e2e8f0",
  },
  "& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#cbd5e1",
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#0a66c2",
    borderWidth: 1,
  },
};

export const articleTitleInputSx = {
  ...articleInputSx,
  "& .MuiInputBase-root": {
    ...articleInputSx["& .MuiInputBase-root"],
    fontSize: { xs: 28, md: 34 },
    fontWeight: 700,
    lineHeight: 1.25,
    bgcolor: "transparent",
    px: 0,
  },
  "& .MuiInputBase-input": {
    ...articleInputSx["& .MuiInputBase-input"],
    px: 0,
    py: 0.5,
  },
  "& fieldset": { border: "none" },
};

export const articleBodyInputSx = {
  ...articleInputSx,
  "& .MuiInputBase-root": {
    ...articleInputSx["& .MuiInputBase-root"],
    fontSize: 16,
    alignItems: "flex-start",
    p: 1.5,
  },
};

export const articlePanelSx = {
  border: "1px solid #e2e8f0",
  borderRadius: 2,
  bgcolor: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

export const articleCanvasSx = {
  bgcolor: "#ffffff",
  border: "1px solid #e1f5fe",
  borderRadius: 2,
  p: { xs: 2, md: 3 },
};

export function sectionPreviewText(body: string, maxLen = 72): string {
  const trimmed = (body || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "No content yet — select to write";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export function sectionWordCount(body: string): number {
  return (body || "").trim().split(/\s+/).filter(Boolean).length;
}
