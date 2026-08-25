import React from 'react';
import { Box, Tooltip, IconButton, Divider } from '@mui/material';
import BoldIcon from '@mui/icons-material/FormatBold';
import ItalicIcon from '@mui/icons-material/FormatItalic';
import LinkIcon from '@mui/icons-material/Link';
import BulletListIcon from '@mui/icons-material/FormatListBulleted';
import NumberedListIcon from '@mui/icons-material/FormatListNumbered';
import QuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import HrIcon from '@mui/icons-material/HorizontalRule';
import TitleIcon from '@mui/icons-material/Title';

interface MarkdownToolbarProps {
  onFormat: (type: string) => void;
}

interface ToolbarButton {
  type: string;
  icon: React.ReactNode;
  tooltip: string;
  shortcut?: string;
}

const buttons: ToolbarButton[] = [
  { type: 'bold', icon: <BoldIcon sx={{ fontSize: 18 }} />, tooltip: 'Bold', shortcut: 'Ctrl+B' },
  { type: 'italic', icon: <ItalicIcon sx={{ fontSize: 18 }} />, tooltip: 'Italic', shortcut: 'Ctrl+I' },
  { type: 'link', icon: <LinkIcon sx={{ fontSize: 18 }} />, tooltip: 'Insert Link' },
];

const headingButtons: ToolbarButton[] = [
  { type: 'heading-2', icon: <TitleIcon sx={{ fontSize: 18, transform: 'scaleX(1.3)' }} />, tooltip: 'Subheading (H2)' },
  { type: 'heading-3', icon: <TitleIcon sx={{ fontSize: 15, transform: 'scaleX(1.2)' }} />, tooltip: 'Subheading (H3)' },
];

const listButtons: ToolbarButton[] = [
  { type: 'bullet-list', icon: <BulletListIcon sx={{ fontSize: 18 }} />, tooltip: 'Bullet List' },
  { type: 'numbered-list', icon: <NumberedListIcon sx={{ fontSize: 18 }} />, tooltip: 'Numbered List' },
];

const blockButtons: ToolbarButton[] = [
  { type: 'blockquote', icon: <QuoteIcon sx={{ fontSize: 18 }} />, tooltip: 'Blockquote' },
  { type: 'code', icon: <CodeIcon sx={{ fontSize: 18 }} />, tooltip: 'Inline Code' },
  { type: 'hr', icon: <HrIcon sx={{ fontSize: 18 }} />, tooltip: 'Horizontal Rule' },
];

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

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat }) => {
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
      }}
    >
      {buttons.map(btn => (
        <Tooltip key={btn.type} title={btn.shortcut ? `${btn.tooltip} (${btn.shortcut})` : btn.tooltip} arrow>
          <IconButton size="small" sx={btnSx} onClick={() => onFormat(btn.type)}>
            {btn.icon}
          </IconButton>
        </Tooltip>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />

      {headingButtons.map(btn => (
        <Tooltip key={btn.type} title={btn.tooltip} arrow>
          <IconButton size="small" sx={btnSx} onClick={() => onFormat(btn.type)}>
            {btn.icon}
          </IconButton>
        </Tooltip>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />

      {listButtons.map(btn => (
        <Tooltip key={btn.type} title={btn.tooltip} arrow>
          <IconButton size="small" sx={btnSx} onClick={() => onFormat(btn.type)}>
            {btn.icon}
          </IconButton>
        </Tooltip>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#e2e8f0' }} />

      {blockButtons.map(btn => (
        <Tooltip key={btn.type} title={btn.tooltip} arrow>
          <IconButton size="small" sx={btnSx} onClick={() => onFormat(btn.type)}>
            {btn.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
};

export default MarkdownToolbar;
