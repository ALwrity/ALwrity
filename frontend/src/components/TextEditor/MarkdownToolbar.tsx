import React from 'react';
import { Box, Tooltip, IconButton, Divider } from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  Link as LinkIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberedListIcon,
  FormatQuote as QuoteIcon,
  Code as CodeIcon,
  HorizontalRule as HrIcon,
  Title as TitleIcon,
} from '@mui/icons-material';
import {
  type MarkdownFormatType,
  DEFAULT_MARKDOWN_TOOLBAR_BUTTONS,
} from './markdownFormatting';

interface MarkdownToolbarProps {
  onFormat: (type: MarkdownFormatType) => void;
  buttons?: MarkdownFormatType[];
  sx?: object;
}

interface ToolbarButton {
  type: MarkdownFormatType;
  icon: React.ReactNode;
  tooltip: string;
  shortcut?: string;
}

const BUTTON_CONFIG: Record<MarkdownFormatType, ToolbarButton> = {
  bold: { type: 'bold', icon: <BoldIcon sx={{ fontSize: 18 }} />, tooltip: 'Bold', shortcut: 'Ctrl+B' },
  italic: { type: 'italic', icon: <ItalicIcon sx={{ fontSize: 18 }} />, tooltip: 'Italic', shortcut: 'Ctrl+I' },
  link: { type: 'link', icon: <LinkIcon sx={{ fontSize: 18 }} />, tooltip: 'Insert Link' },
  'heading-2': { type: 'heading-2', icon: <TitleIcon sx={{ fontSize: 18, transform: 'scaleX(1.3)' }} />, tooltip: 'Subheading (H2)' },
  'heading-3': { type: 'heading-3', icon: <TitleIcon sx={{ fontSize: 15, transform: 'scaleX(1.2)' }} />, tooltip: 'Subheading (H3)' },
  'bullet-list': { type: 'bullet-list', icon: <BulletListIcon sx={{ fontSize: 18 }} />, tooltip: 'Bullet List' },
  'numbered-list': { type: 'numbered-list', icon: <NumberedListIcon sx={{ fontSize: 18 }} />, tooltip: 'Numbered List' },
  blockquote: { type: 'blockquote', icon: <QuoteIcon sx={{ fontSize: 18 }} />, tooltip: 'Blockquote' },
  code: { type: 'code', icon: <CodeIcon sx={{ fontSize: 18 }} />, tooltip: 'Inline Code' },
  hr: { type: 'hr', icon: <HrIcon sx={{ fontSize: 18 }} />, tooltip: 'Horizontal Rule' },
};

const DIVIDER_AFTER: MarkdownFormatType[] = ['italic', 'heading-3', 'numbered-list'];

const btnSx = {
  width: 30,
  height: 30,
  borderRadius: '6px',
  color: '#64748b',
  transition: 'all 0.15s ease',
  '&:hover': {
    bgcolor: '#eef2ff',
    color: '#4f46e5',
  },
};

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat, buttons = DEFAULT_MARKDOWN_TOOLBAR_BUTTONS, sx }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        bgcolor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderBottom: 'none',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        ...(sx || {}),
      }}
    >
      {buttons.map((type, i) => {
        const btn = BUTTON_CONFIG[type];
        const showDividerAfter = DIVIDER_AFTER.includes(type) && i < buttons.length - 1;
        return (
          <React.Fragment key={type}>
            <Tooltip title={btn.shortcut ? `${btn.tooltip} (${btn.shortcut})` : btn.tooltip} arrow>
              <IconButton size="small" sx={btnSx} onClick={() => onFormat(type)}>
                {btn.icon}
              </IconButton>
            </Tooltip>
            {showDividerAfter && (
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default MarkdownToolbar;