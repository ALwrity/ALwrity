/**
 * Textarea with optional green highlight overlay for recently added assistive text.
 * Native textareas cannot host spans — overlay mirrors text behind a transparent textarea.
 */

import React, { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import type { AssistiveTextHighlightRange } from "../utils/linkedInAssistiveHighlightUtils";

const LOG_PREFIX = "[LinkedInAssistiveHighlightField]";
const AUTO_CLEAR_MS = 12000;

const sharedTextStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  fontFamily: "inherit",
  fontSize: "14px",
  lineHeight: "1.6",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

export interface LinkedInAssistiveHighlightFieldProps {
  value: string;
  highlightRange: AssistiveTextHighlightRange | null;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onHighlightClear?: () => void;
  onMouseUp?: () => void;
  onKeyUp?: () => void;
  onBlur?: () => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  borderTop?: string;
  placeholder?: string;
  minHeight?: number;
}

export const LinkedInAssistiveHighlightField: React.FC<
  LinkedInAssistiveHighlightFieldProps
> = ({
  value,
  highlightRange,
  onChange,
  onHighlightClear,
  onMouseUp,
  onKeyUp,
  onBlur,
  textareaRef,
  borderTop = "none",
  placeholder = "What do you want to talk about?",
  minHeight = 160,
}) => {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const hasHighlight =
    !!highlightRange &&
    highlightRange.end > highlightRange.start &&
    highlightRange.start >= 0 &&
    highlightRange.end <= value.length;

  useEffect(() => {
    if (!hasHighlight) return;
    console.log(`${LOG_PREFIX} in-editor highlight active`, {
      range: highlightRange,
      valueLength: value.length,
    });
  }, [hasHighlight, highlightRange, value.length]);

  useEffect(() => {
    if (!hasHighlight || !onHighlightClear) return undefined;
    const timer = window.setTimeout(() => {
      console.log(`${LOG_PREFIX} auto-clear in-editor highlight`);
      onHighlightClear();
    }, AUTO_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [hasHighlight, highlightRange, onHighlightClear]);

  const syncBackdropScroll = () => {
    const ta = localRef.current;
    const bg = backdropRef.current;
    if (ta && bg) {
      bg.scrollTop = ta.scrollTop;
      bg.scrollLeft = ta.scrollLeft;
      bg.style.height = `${ta.clientHeight}px`;
    }
  };

  useEffect(() => {
    if (!hasHighlight) return;
    syncBackdropScroll();
    const ta = localRef.current;
    if (!ta || !highlightRange) return;
    // Backup: native selection also shows green via ::selection styles.
    try {
      ta.focus();
      ta.setSelectionRange(highlightRange.start, highlightRange.end);
    } catch (err) {
      console.warn(`${LOG_PREFIX} could not set selection range`, err);
    }
  }, [hasHighlight, highlightRange, value]);

  const setRefs = (node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof textareaRef === "function") {
      textareaRef(node);
    } else if (textareaRef) {
      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
        node;
    }
  };

  const before = hasHighlight ? value.slice(0, highlightRange!.start) : value;
  const added = hasHighlight
    ? value.slice(highlightRange!.start, highlightRange!.end)
    : "";
  const after = hasHighlight ? value.slice(highlightRange!.end) : "";

  return (
    <Box>
      {hasHighlight && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            px: 1.5,
            py: 0.75,
            bgcolor: "#f0fdf4",
            borderLeft: "1px solid #e2e8f0",
            borderRight: "1px solid #e2e8f0",
            color: "#166534",
            fontWeight: 600,
          }}
        >
          Green highlight = text just added by Assistive Writing
          {onHighlightClear && (
            <Box
              component="button"
              type="button"
              onClick={onHighlightClear}
              sx={{
                ml: 1.5,
                border: "none",
                background: "transparent",
                color: "#15803d",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "inherit",
                p: 0,
              }}
            >
              Dismiss
            </Box>
          )}
        </Typography>
      )}

      <Box sx={{ position: "relative" }}>
        {hasHighlight && (
          <Box
            ref={backdropRef}
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 0,
              pointerEvents: "none",
              border: "1px solid transparent",
              borderTop,
              borderRadius: "0 0 8px 8px",
              background: "#fff",
              color: "#333",
              minHeight,
              overflow: "hidden",
              ...sharedTextStyle,
            }}
          >
            {before}
            <Box
              component="mark"
              sx={{
                background: "#bbf7d0",
                color: "#14532d",
                fontWeight: 600,
                borderRadius: "2px",
                padding: "0 1px",
              }}
            >
              {added}
            </Box>
            {after}
          </Box>
        )}

        <textarea
          ref={setRefs}
          value={value}
          onChange={(event) => {
            if (hasHighlight) onHighlightClear?.();
            onChange(event);
          }}
          onScroll={syncBackdropScroll}
          onMouseUp={onMouseUp}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          autoFocus
          placeholder={placeholder}
          className={hasHighlight ? "liw-assistive-highlight-active" : undefined}
          style={{
            ...sharedTextStyle,
            position: "relative",
            zIndex: 1,
            display: "block",
            outline: "none",
            border: "1px solid #e2e8f0",
            borderTop,
            borderRadius: "0 0 8px 8px",
            background: hasHighlight ? "transparent" : "#fff",
            color: hasHighlight ? "transparent" : "#333",
            WebkitTextFillColor: hasHighlight ? "transparent" : undefined,
            caretColor: "#333",
            resize: "vertical",
            minHeight,
          }}
        />
        <style>{`
          .liw-assistive-highlight-active::selection {
            background: #bbf7d0;
            color: #14532d;
          }
        `}</style>
      </Box>
    </Box>
  );
};
