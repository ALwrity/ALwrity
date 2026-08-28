import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Paper, 
  IconButton, 
  Chip, 
  TextField, 
  Tooltip, 
  CircularProgress,
  Divider,
  Box
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import useBlogTextSelectionHandler from './BlogTextSelectionHandler';
import HoverMenu from './HoverMenu';
import { blogWriterApi } from '../../../services/blogWriterApi';
import { TextToSpeechButton } from '../../shared/TextToSpeechButton';

interface BlogSectionProps {
  id: any;
  title: string;
  content: string;
  wordCount: number;
  sources: number;
  outlineData?: {
    subheadings: string[];
    keyPoints: string[];
    keywords: string[];
    references: any[];
    targetWords: number;
  };
  onContentUpdate?: (sections: any[]) => void;
  onDeleteSection?: (sectionId: any) => void;
  expandedSections: Set<any>;
  toggleSectionExpansion: (sectionId: any) => void;
  refreshToken?: number;
  flowAnalysisResults?: any;
  sectionImage?: string;
  convertMarkdownToHTML?: (md: string) => string;
}

const BlogSection: React.FC<BlogSectionProps> = ({ 
  id, 
  title, 
  content: initialContent, 
  sources, 
  outlineData, 
  onContentUpdate,
  onDeleteSection,
  expandedSections,
  toggleSectionExpansion,
  refreshToken,
  flowAnalysisResults,
  sectionImage,
  convertMarkdownToHTML
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [sectionTitle, setSectionTitle] = useState(title);
  const [content, setContent] = useState(initialContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [toolsAnchorEl, setToolsAnchorEl] = useState<HTMLElement | null>(null);
  const [activeTool, setActiveTool] = useState<null | 'originality' | 'optimize' | 'fact' | 'links' | 'flow'>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);

  const wordCount_ = useMemo(() => content.split(/\s+/).filter(Boolean).length, [content]);

  const handleFormatText = useCallback((formatType: string, startPos?: number, endPos?: number) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = startPos ?? textarea.selectionStart;
    const end = endPos ?? textarea.selectionEnd;
    const selected = content.substring(start, end);
    const trimmed = selected.trim();
    let replacement: string;
    let cursorPos: number;

    switch (formatType) {
      case 'bold': {
        const outerMatch = trimmed.match(/^\*\*(.+)\*\*$/s);
        if (outerMatch) {
          replacement = outerMatch[1];
        } else {
          replacement = `**${trimmed.replace(/\*\*/g, '')}**`;
        }
        cursorPos = start + replacement.length;
        break;
      }
      case 'italic': {
        const outerMatch = trimmed.match(/^\*(?!\*)(.+)(?<!\*)\*$/s);
        if (outerMatch) {
          replacement = outerMatch[1];
        } else {
          replacement = `*${trimmed.replace(/\*/g, '')}*`;
        }
        cursorPos = start + replacement.length;
        break;
      }
      case 'link': {
        replacement = trimmed ? `[${trimmed}](url)` : `[text](url)`;
        cursorPos = trimmed ? start + replacement.length - 5 : start + 1;
        break;
      }
      case 'heading-2': {
        replacement = trimmed ? `## ${trimmed}` : `## Heading`;
        cursorPos = start + replacement.length;
        break;
      }
      case 'heading-3': {
        replacement = trimmed ? `### ${trimmed}` : `### Heading`;
        cursorPos = start + replacement.length;
        break;
      }
      case 'bullet-list': {
        replacement = trimmed ? `- ${trimmed}` : `- List item`;
        cursorPos = start + replacement.length;
        break;
      }
      case 'numbered-list': {
        replacement = trimmed ? `1. ${trimmed}` : `1. List item`;
        cursorPos = start + replacement.length;
        break;
      }
      case 'blockquote': {
        replacement = trimmed ? `> ${trimmed}` : `> Quote`;
        cursorPos = start + replacement.length;
        break;
      }
      case 'code': {
        const outerMatch = trimmed.match(/^`(.+)`$/s);
        if (outerMatch) {
          replacement = outerMatch[1];
        } else {
          replacement = `\`${trimmed.replace(/`/g, '')}\``;
        }
        cursorPos = start + replacement.length;
        break;
      }
      case 'hr': {
        replacement = `\n\n---\n\n`;
        cursorPos = start + replacement.length;
        break;
      }
      default:
        return;
    }

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    if (onContentUpdate) onContentUpdate([{ id, content: newContent }]);

    window.dispatchEvent(new CustomEvent('blogwriter:replaceSelectedText', {
      detail: { originalText: selected, editedText: replacement, editType: 'format' }
    }));

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }, [content, id, onContentUpdate]);

  const assistiveWriting = useBlogTextSelectionHandler(
    contentRef,
    (originalText: string, newText: string, editType: string) => {
      if (contentRef.current) {
        const textarea = contentRef.current;
        let updatedContent: string;
        if (editType === 'smart-suggestion') {
          updatedContent = newText;
        } else {
          updatedContent = textarea.value.replace(originalText, newText);
        }
        setContent(updatedContent);
        if (onContentUpdate) onContentUpdate([{ id, content: updatedContent }]);
      }
    },
    handleFormatText
  );

  const formatContent = (rawContent: string) => {
    if (!rawContent) return rawContent;
    return rawContent.replace(/\n{3,}/g, '\n\n').replace(/\n(?!\n)/g, '\n\n').trim();
  };

  useEffect(() => {
    if (initialContent !== content) {
      setContent(formatContent(initialContent));
    }
  }, [initialContent]);
  
  const handleContentChange = (e: any) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);
    assistiveWriting.handleTypingChange(newContent, cursorPos);
  };
  
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const closeToolDialog = () => {
    setToolDialogOpen(false);
    setToolLoading(false);
  };

  const runSectionTool = useCallback(async (tool: 'originality' | 'optimize' | 'fact' | 'links' | 'flow') => {
    setActiveTool(tool);
    setToolResult(null);
    setToolLoading(true);
    setToolDialogOpen(true);

    try {
      let res;
      if (tool === 'originality') {
        res = await blogWriterApi.sectionOriginalityTools({ section_id: String(id), title: sectionTitle, content });
      } else if (tool === 'links') {
        res = await blogWriterApi.sectionInternalLinkTools({ section_id: String(id), title: sectionTitle, content });
      } else if (tool === 'fact') {
        res = await blogWriterApi.sectionFactCheckTools({ section_id: String(id), title: sectionTitle, content });
      } else if (tool === 'optimize') {
        res = await blogWriterApi.sectionOptimizeTools({
          section_id: String(id), title: sectionTitle, content,
          keywords: outlineData?.keywords || [], goal: 'readability'
        });
      } else if (tool === 'flow') {
        res = await blogWriterApi.analyzeFlowAdvanced({
          title: sectionTitle,
          sections: [{ id: String(id), heading: sectionTitle, content }]
        });
      }
      setToolResult(res);
    } catch (error: any) {
      setToolResult({ success: false, error: error?.message || 'Request failed' });
    } finally {
      setToolLoading(false);
    }
  }, [id, sectionTitle, content, outlineData]);

  const applyOptimizedContent = () => {
    const next = toolResult?.optimized_content;
    if (!next) return;
    setContent(next);
    if (onContentUpdate) onContentUpdate([{ id, content: next }]);
    closeToolDialog();
  };

  const insertLinkSuggestion = (url: string) => {
    if (!url) return;
    const next = `${content || ''}\n\n[Related](${url})`;
    setContent(next);
    if (onContentUpdate) onContentUpdate([{ id, content: next }]);
  };

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
  };

  // HoverMenu action handler
  const handleSectionAction = useCallback((action: string) => {
    switch (action) {
      case 'generate-content':
        handleGenerateContent();
        break;
      case 'enhance-section':
        runSectionTool('optimize');
        break;
      case 'fact-check':
        runSectionTool('fact');
        break;
      case 'source-mapping':
        runSectionTool('originality');
        break;
      case 'seo-analysis':
        runSectionTool('flow');
        break;
      case 'add-subsection':
        break;
      case 'copy-section':
        break;
      case 'delete-section':
        break;
      default:
        break;
    }
  }, []);

  return (
    <div 
      className="group relative mb-8" 
      id={`section-${id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-gray-300 select-none">{id}.</span>
        {isEditing ? (
          <TextField
            fullWidth
            variant="standard"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditing(false); }}
            autoFocus
            InputProps={{ disableUnderline: true, className: 'text-xl md:text-2xl font-bold font-serif text-gray-800' }}
          />
        ) : (
          <h2
            className="flex-1 text-xl md:text-2xl font-bold font-serif text-gray-800 cursor-text hover:text-indigo-600 transition-colors duration-150"
            onClick={() => setIsEditing(true)}
          >
            {sectionTitle}
          </h2>
        )}
        
        {/* Section Toolbar - Shows on hover, positioned next to title */}
        <div 
          className="section-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: isHovered ? 'auto' : 'none',
          }}
        >
          {/* Preview/Edit Toggle */}
          {convertMarkdownToHTML && (
            <Tooltip title={isPreviewing ? 'Edit content' : 'Preview content'}>
              <IconButton 
                size="small" 
                onClick={() => setIsPreviewing(!isPreviewing)} 
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: isPreviewing ? '#4f46e5' : 'white',
                  color: isPreviewing ? 'white' : '#475569',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '&:hover': {
                    bgcolor: isPreviewing ? '#4338ca' : '#f8fafc',
                    borderColor: isPreviewing ? '#4338ca' : '#cbd5e1',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {isPreviewing ? <EditIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          )}
          
          {/* Copy Button */}
          <Tooltip title="Copy section">
            <IconButton size="small" sx={{ 
              width: 32, 
              height: 32,
              bgcolor: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: '#f8fafc',
                borderColor: '#cbd5e1',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              },
              transition: 'all 0.2s ease',
            }}>
              <FileCopyOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          
          {/* More Actions */}
          <Tooltip title="Section actions">
            <IconButton size="small" onClick={(e) => setToolsAnchorEl(e.currentTarget)} sx={{ 
              width: 32, 
              height: 32,
              bgcolor: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: '#f8fafc',
                borderColor: '#cbd5e1',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              },
              transition: 'all 0.2s ease',
            }}>
              <MoreHorizIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          
          {/* Delete Button */}
          <Tooltip title="Delete section">
            <IconButton size="small" onClick={() => {
              if (window.confirm(`Are you sure you want to delete "${sectionTitle}"? This cannot be undone.`)) {
                onDeleteSection?.(id);
              }
            }} sx={{ 
              width: 32, 
              height: 32,
              bgcolor: 'white',
              color: '#ef4444',
              border: '1px solid #fecaca',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: '#fef2f2',
                borderColor: '#fca5a5',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              },
              transition: 'all 0.2s ease',
            }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          
          {/* Text-to-Speech Button */}
          {content && content.trim().length > 0 && (
            <TextToSpeechButton 
              text={content}
              size="small"
              showSettings={false}
              disabled={isPreviewing}
            />
          )}
        </div>
      </div>

{sectionImage && (
        <div className="mb-4">
          <div className="rounded-lg overflow-hidden border border-gray-100 bg-white max-w-full mx-auto" style={{ maxWidth: 'min(100%, 720px)' }}>
            <img 
              src={sectionImage.startsWith('http') || sectionImage.startsWith('/api/') ? sectionImage : `data:image/png;base64,${sectionImage}`}
              alt={`Image for ${sectionTitle}`}
              className="block w-full max-w-full h-auto max-h-96 object-contain mx-auto"
            />
          </div>
        </div>
)}

      {isGenerating ? (
        <div className="flex items-center gap-3 p-6 bg-indigo-50/50 rounded-lg border border-indigo-100/50 mb-3">
          <CircularProgress size={20} className="text-indigo-400" />
          <span className="text-sm text-indigo-600 font-medium">Generating content...</span>
        </div>
      ) : isPreviewing && convertMarkdownToHTML ? (
        // Preview Mode
        <div className="relative">
          <Box
            className="preview-content"
            sx={{
              p: 3,
              bgcolor: '#fafbfc',
              borderRadius: 2,
              border: '1px solid #e5e7eb',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.8,
              color: '#1f2937',
              '& h1, & h2, & h3': { color: '#111827', mt: 2, mb: 1 },
              '& h2': { fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid #e5e7eb', pb: 1 },
              '& h3': { fontSize: '1.25rem', fontWeight: 600 },
              '& h4': { fontSize: '1.15rem', fontWeight: 600, color: '#1e293b', mt: 1.5, mb: 0.5 },
              '& h5, & h6': { fontSize: '1rem', fontWeight: 600, color: '#334155', mt: 1.5, mb: 0.5 },
              '& p': { mb: 1.5 },
              '& strong': { fontWeight: 600 },
              '& em': { fontStyle: 'italic' },
              '& a': { color: '#4f46e5', textDecoration: 'underline' },
              '& blockquote': {
                borderLeft: '4px solid #e5e7eb',
                pl: 2,
                py: 1,
                color: '#6b7280',
                fontStyle: 'italic',
                bgcolor: '#f9fafb',
              },
              '& code': {
                bgcolor: '#f1f5f9',
                px: 1,
                py: 0.5,
                borderRadius: 0.25,
                fontFamily: 'monospace',
                fontSize: '0.9em',
              },
              '& kbd': {
                bgcolor: '#f1f5f9',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                px: 1,
                py: 0.25,
                fontFamily: 'monospace',
                fontSize: '0.85em',
                boxShadow: '0 1px 0 #d1d5db',
              },
              '& mark': { bgcolor: '#fef3c7', color: '#92400e', px: 0.5, borderRadius: 0.25 },
              '& sub, & sup': { fontSize: '0.75em', lineHeight: 1 },
              '& details': { mb: 1.5 },
              '& details summary': { cursor: 'pointer', fontWeight: 600, color: '#1e293b' },
              '& details summary:hover': { color: '#4f46e5' },
              '& dl': { mb: 1.5 },
              '& dl dt': { fontWeight: 600, color: '#1e293b', mt: 1 },
              '& dl dd': { ml: 2, color: '#4b5563' },
              '& abbr': { cursor: 'help', textDecoration: 'underline dotted #94a3b8' },
              '& ul, & ol': { pl: 2, mb: 1.5 },
              '& li': { mb: 0.5 },
              '& hr': { borderColor: '#e5e7eb', my: 2 },
              '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
              '& table': { borderCollapse: 'collapse', width: '100%', mb: 2, fontSize: '0.95rem' },
              '& th, & td': { border: '1px solid #d1d5db', px: 2, py: 1, textAlign: 'left' },
              '& th': { bgcolor: '#f3f4f6', fontWeight: 600 },
              '& tr:nth-of-type(even)': { bgcolor: '#f9fafb' },
              '& .table-wrapper': { overflowX: 'auto', mb: 2 },
              '& .table-wrapper table': { mb: 0 },
              '& pre': { bgcolor: '#1e293b', color: '#e2e8f0', p: 2.5, borderRadius: 1, overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.5, mb: 2 },
              '& pre code': { bgcolor: 'transparent', color: 'inherit', p: 0, fontSize: 'inherit', lineHeight: 'inherit' },
              '& del': { color: '#991b1b', textDecoration: 'line-through' },
              '& input[type="checkbox"]': { mr: 1, transform: 'scale(1.1)', accentColor: '#4f46e5' },
            }}
            dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(content) }}
          />
        </div>
      ) : (
        // Edit Mode
        <div className="relative">
          <TextField
            multiline
            fullWidth
            variant="outlined"
            placeholder="Start writing... Use the toolbar above to format text, or type markdown directly."
            value={content}
            onChange={handleContentChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onSelect={assistiveWriting.handleTextSelection}
            inputRef={contentRef}
            minRows={5}
            InputProps={{
              className: `font-serif text-base leading-relaxed text-gray-700 ${isFocused ? 'bg-white' : 'bg-gray-50/30'}`,
              style: { lineHeight: '1.8', padding: '12px 16px' },
            }}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                border: '1px solid #e2e8f0',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              },
              '& .MuiOutlinedInput-root': { padding: 0 },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4f46e5', borderWidth: 2 },
              '& .MuiInputBase-input': { padding: '12px 16px !important' },
            }}
          />
        </div>
      )}

      {/* Outline info */}
      {outlineData && expandedSections.has(id) && (
        <div className="mt-3 mb-2">
          <Paper elevation={0} sx={{ p: 3, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #f0f0f0' }}>
            <div className="grid grid-cols-2 gap-4">
              {outlineData.keyPoints?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Points</div>
                  <div className="flex flex-wrap gap-1.5">
                    {outlineData.keyPoints.map((point: any, i: any) => (
                      <Chip key={i} label={point} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 24 }} />
                    ))}
                  </div>
                </div>
              )}
              {outlineData.subheadings?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Subheadings</div>
                  <div className="flex flex-wrap gap-1.5">
                    {outlineData.subheadings.map((sub: any, i: any) => (
                      <Chip key={i} label={sub} size="small" variant="outlined" color="secondary" sx={{ fontSize: '0.7rem', height: 24 }} />
                    ))}
                  </div>
                </div>
              )}
              {outlineData.targetWords > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Target words</div>
                  <div className="text-sm text-gray-700">{outlineData.targetWords}</div>
                </div>
              )}
              {outlineData.keywords?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {outlineData.keywords.map((kw: any, i: any) => (
                      <Chip key={i} label={kw} size="small" variant="filled" color="primary" sx={{ fontSize: '0.7rem', height: 24 }} />
                    ))}
                  </div>
                </div>
              )}
              {outlineData.references?.length > 0 && (
                <div className="col-span-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    References ({outlineData.references.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {outlineData.references.slice(0, 3).map((ref: any, i: any) => (
                      <Chip key={i} label={ref.title || `Source ${i + 1}`} size="small" variant="outlined" color="info" sx={{ fontSize: '0.7rem', height: 24 }} />
                    ))}
                    {outlineData.references.length > 3 && (
                      <Chip label={`+${outlineData.references.length - 3} more`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 24 }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Paper>
        </div>
      )}
      
      {/* Bottom word count - compact */}
      <div className="flex items-center justify-between mt-2" style={{ opacity: isHovered || isFocused ? 1 : 0, transition: 'opacity 0.2s' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ fontWeight: 600, color: '#94a3b8' }}>
            📝 {wordCount_} words
          </span>
          {outlineData?.targetWords && outlineData.targetWords > 0 && (
            <>
              <span className="text-gray-300 text-xs">/</span>
              <span className="text-xs" style={{ 
                fontWeight: 600, 
                color: wordCount_ >= outlineData.targetWords * 0.9 ? '#10b981' : '#94a3b8',
              }}>
                {outlineData.targetWords} target
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {outlineData && (
            <Tooltip title={expandedSections.has(id) ? 'Hide outline info' : 'Show outline info'}>
              <IconButton size="small" onClick={() => toggleSectionExpansion(id)} sx={{ 
                width: 28, 
                height: 28,
                bgcolor: 'transparent',
                color: '#64748b',
                '&:hover': {
                  bgcolor: '#f1f5f9',
                },
              }}>
                {expandedSections.has(id) ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* HoverMenu for section-level actions */}
      <HoverMenu
        anchorEl={toolsAnchorEl}
        open={Boolean(toolsAnchorEl)}
        onClose={() => setToolsAnchorEl(null)}
        type="section"
        onAction={handleSectionAction}
        context={{
          sectionId: String(id),
          hasContent: content.trim().length > 0,
          sources,
          wordCount: wordCount_,
        }}
      />

      {/* Tool result dialog */}
      {toolDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={closeToolDialog}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">
                {activeTool === 'originality' && 'Originality Check'}
                {activeTool === 'optimize' && 'Optimize Section'}
                {activeTool === 'fact' && 'SIF Fact Check'}
                {activeTool === 'links' && 'Internal Link Suggestions'}
                {activeTool === 'flow' && 'Flow Analysis'}
              </h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {toolLoading && (
                <div className="flex items-center gap-3">
                  <CircularProgress size={18} />
                  <span className="text-sm text-gray-500">Working...</span>
                </div>
              )}
              {!toolLoading && toolResult?.error && (
                <div className="text-red-600 font-medium">{toolResult.error}</div>
              )}
              {!toolLoading && activeTool === 'optimize' && toolResult?.optimized_content && (
                <div className="space-y-3">
                  {toolResult?.diff_summary && <p className="font-medium">{toolResult.diff_summary}</p>}
                  {Array.isArray(toolResult?.changes_made) && toolResult.changes_made.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1">
                      {toolResult.changes_made.map((c: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-600">{c}</li>
                      ))}
                    </ul>
                  )}
                  <TextField multiline minRows={10} value={toolResult.optimized_content} fullWidth InputProps={{ readOnly: true }} />
                </div>
              )}
              {!toolLoading && activeTool === 'links' && (
                <div className="space-y-2">
                  {Array.isArray(toolResult?.suggestions) && toolResult.suggestions.length > 0 ? (
                    toolResult.suggestions.map((s: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{s.url}</p>
                          <p className="text-xs text-gray-500">confidence: {(s.confidence ?? 0).toFixed?.(2) ?? s.confidence}</p>
                        </div>
                        <button onClick={() => insertLinkSuggestion(s.url)} className="text-sm text-indigo-600 hover:text-indigo-800 ml-3 shrink-0">Insert</button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No suggestions yet. Make sure SIF index has your website content.</p>
                  )}
                </div>
              )}
              {!toolLoading && activeTool === 'originality' && (
                <div className="space-y-3">
                  {toolResult?.cannibalization && <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(toolResult.cannibalization, null, 2)}</pre>}
                  {Array.isArray(toolResult?.matches) && toolResult.matches.length > 0 ? (
                    <div className="space-y-2">
                      {toolResult.matches.map((m: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium">{m.id ?? 'unknown'} ({(m.score ?? 0).toFixed?.(3) ?? m.score})</p>
                          {m.excerpt && <p className="text-xs text-gray-500 mt-1">{m.excerpt}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No close matches found.</p>
                  )}
                </div>
              )}
              {!toolLoading && activeTool === 'fact' && (
                <div className="space-y-3">
                  {toolResult?.verification && <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(toolResult.verification, null, 2)}</pre>}
                  {Array.isArray(toolResult?.citations) && toolResult.citations.length > 0 && (
                    <div className="space-y-2">
                      {toolResult.citations.map((c: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm">{c.citation_text || c.title || c.source}</p>
                          <p className="text-xs text-gray-500">{c.source}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!toolLoading && activeTool === 'flow' && (
                <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(toolResult, null, 2)}</pre>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={closeToolDialog} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Close</button>
              {activeTool === 'optimize' && toolResult?.optimized_content && (
                <button onClick={applyOptimizedContent} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">Replace Section Content</button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <Divider sx={{ mt: 2, opacity: 0.2 }} />
      
      {assistiveWriting.renderSelectionMenu()}
    </div>
  );
};

export default BlogSection;
