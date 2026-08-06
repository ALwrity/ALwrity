/**
 * MUI theme for LinkedIn Studio editor toolbar chrome.
 */

import type { CSSProperties } from "react";
import { createTheme } from "@mui/material/styles";

export const editorShellTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0a66c2" },
    text: { primary: "#1e293b", secondary: "#64748b" },
  },
});

export const editorShellToolbarStyle: CSSProperties = {
  padding: "6px 14px",
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
  flexWrap: "wrap",
  rowGap: 4,
  overflowX: "auto",
  borderBottom: "1px solid #e8ecf1",
  background: "#fafbfc",
  minHeight: 42,
};
