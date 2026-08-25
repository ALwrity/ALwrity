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

interface CompactSelectionMenuProps {
  selectionMenu: { x: number; y: number; text: string; start: number; end: number } | null;
  factCheckResults: any;
  isFactChecking: boolean;
  factCheckProgress: { step: string; progress: number } | null;
  smartSuggestion: any;
  isGeneratingSuggestion: boolean;
  allSuggestions: any[];
  suggestionIndex: number;
  showContinueWritingPrompt: boolean;
  onCheckFacts: (text: string) => void;
  onGenerateChart: (text: string) => void;
  onFindLinks: (text: string) => void;
  onCloseFactCheckResults: () => void;
  onQuickEdit: (editType: string, selectedText: string) => void;
  onAcceptSuggestion: () => void;
  onRejectSuggestion: () => void;
  onNextSuggestion: () => void;
  onRequestSuggestion: () => void;
  onDismissPrompt: () => void;
  onFormatText: (type: string, start?: number, end?: number) => void;
}

const formatBtnSx = {
  width: 30,
  height: 30,
  borderRadius: '6px',
  color: 'rgba(255,255,255,0.85)',
  transition: 'all 0.15s ease',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', color: 'white' },
};

const formatButtons = [
  { type: 'bold', icon: <BoldIcon sx={{ fontSize: 16 }} />, label: 'Bold' },
  { type: 'italic', icon: <ItalicIcon sx={{ fontSize: 16 }} />, label: 'Italic' },
  { type: 'link', icon: <LinkIcon sx={{ fontSize: 16 }} />, label: 'Link' },
  { type: 'heading-2', icon: <TitleIcon sx={{ fontSize: 15, transform: 'scaleX(1.2)' }} />, label: 'H2' },
  { type: 'heading-3', icon: <TitleIcon sx={{ fontSize: 13, transform: 'scaleX(1.1)' }} />, label: 'H3' },
  { type: 'bullet-list', icon: <BulletListIcon sx={{ fontSize: 16 }} />, label: 'Bullet' },
  { type: 'numbered-list', icon: <NumberedListIcon sx={{ fontSize: 16 }} />, label: 'Numbered' },
  { type: 'blockquote', icon: <QuoteIcon sx={{ fontSize: 16 }} />, label: 'Quote' },
  { type: 'code', icon: <CodeIcon sx={{ fontSize: 16 }} />, label: 'Code' },
  { type: 'hr', icon: <HrIcon sx={{ fontSize: 16 }} />, label: 'HR' },
];

const aiButtons = [
  { type: 'improve', label: '✏️ Improve Shorten Expand' },
];

const btnBase: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.15)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  padding: '5px 10px',
  color: 'white',
  fontSize: '11px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const CompactSelectionMenu: React.FC<CompactSelectionMenuProps> = ({
  selectionMenu,
  factCheckResults,
  isFactChecking,
  factCheckProgress,
  smartSuggestion,
  isGeneratingSuggestion,
  allSuggestions,
  suggestionIndex,
  showContinueWritingPrompt,
  onCheckFacts,
  onGenerateChart,
  onFindLinks,
  onCloseFactCheckResults,
  onQuickEdit,
  onAcceptSuggestion,
  onRejectSuggestion,
  onNextSuggestion,
  onRequestSuggestion,
  onDismissPrompt,
  onFormatText,
}) => {
  if (!selectionMenu) return null;

  const x = Math.max(8, Math.min(selectionMenu.x - 180, window.innerWidth - 380));

  return (
    <div
      data-selection-menu="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: selectionMenu.y - 10,
        left: x,
        background: 'rgba(79, 70, 229, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px 10px',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        zIndex: 10000,
        minWidth: '340px',
        maxWidth: '380px',
      }}
    >
      {/* Formatting Section */}
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '4px',
          paddingLeft: '2px',
        }}>
          ✏️ Format
        </div>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {formatButtons.map(btn => (
            <Tooltip key={btn.type} title={btn.label} arrow>
              <IconButton size="small" sx={formatBtnSx} onClick={() => onFormatText(btn.type)}>
                {btn.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </div>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', my: '4px' }} />

      {/* AI Tools Section */}
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '4px',
          paddingLeft: '2px',
        }}>
          🤖 AI Tools
        </div>

        {/* Primary AI Actions */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onCheckFacts(selectionMenu.text); }}
            disabled={isFactChecking}
            style={{
              ...btnBase,
              background: isFactChecking ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
              opacity: isFactChecking ? 0.6 : 1,
              cursor: isFactChecking ? 'not-allowed' : 'pointer',
              flex: 1,
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => { if (!isFactChecking) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { if (!isFactChecking) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            {isFactChecking ? '⏳ Verifying...' : '🔍 Fact Check'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onGenerateChart(selectionMenu.text); }}
            style={{ ...btnBase, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.45)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.3)'; }}
          >
            📊 Chart
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFindLinks(selectionMenu.text); }}
            style={{ ...btnBase, flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.45)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.3)'; }}
          >
            🔗 Links
          </button>
        </div>

        {/* Quick Edit Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '4px',
        }}>
          {['improve', 'shorten', 'expand', 'professionalize', 'add-transition', 'add-data'].map(type => {
            const labels: Record<string, string> = {
              improve: '✏️ Improve',
              shorten: '✂️ Shorten',
              expand: '📝 Expand',
              professionalize: '🎓 Professional',
              'add-transition': '🔗 Transition',
              'add-data': '📊 Add Data',
            };
            return (
              <button
                key={type}
                onClick={(e) => { e.stopPropagation(); onQuickEdit(type, selectionMenu.text); }}
                style={btnBase}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fact Check Progress */}
      {factCheckProgress && (
        <div style={{
          marginTop: '4px',
          padding: '6px 8px',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{factCheckProgress.step}</span>
        </div>
      )}

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default CompactSelectionMenu;
