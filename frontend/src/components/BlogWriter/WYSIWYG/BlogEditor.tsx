import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createTheme, ThemeProvider, Paper, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, TextField, Chip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import BarChartIcon from '@mui/icons-material/BarChart';
import HubIcon from '@mui/icons-material/Hub';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { BlogOutlineSection, BlogResearchResponse, blogWriterApi } from '../../../services/blogWriterApi';
import BlogSection from './BlogSection';
import EditorSidebar from './EditorSidebar';
import HoverMenu from './HoverMenu';
import { useMarkdownProcessor } from '../../../hooks/useMarkdownProcessor';
import BlogPreviewModal from '../BlogPreviewModal';
import PlayAllTTSButton from '../PlayAllTTSButton';
import OnThisPageNav from './OnThisPageNav';
import { debug } from '../../../utils/debug';

const theme = createTheme({
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  palette: {
    primary: { main: '#4f46e5' },
  },
});

interface BlogEditorProps {
  outline: BlogOutlineSection[];
  research: BlogResearchResponse | null;
  initialTitle?: string;
  titleOptions?: string[];
  researchTitles?: string[];
  aiGeneratedTitles?: string[];
  sections?: Record<string, string>;
  introduction?: string;
  onContentUpdate?: (sections: any[]) => void;
  onSave?: (content: any) => void;
  onIntroductionUpdate?: (intro: string) => void;
  continuityRefresh?: number;
  flowAnalysisResults?: any;
  sectionImages?: Record<string, string>;
  sourceMappingStats?: any;
  groundingInsights?: any;
}

const BlogEditor: React.FC<BlogEditorProps> = ({ 
  outline, 
  research, 
  initialTitle,
  titleOptions = [],
  researchTitles = [],
  aiGeneratedTitles = [],
  sections: parentSections,
  introduction: parentIntroduction,
  onContentUpdate, 
  onSave,
  onIntroductionUpdate,
  continuityRefresh,
  flowAnalysisResults,
  sectionImages = {},
  sourceMappingStats,
  groundingInsights
}) => {
  const [blogTitle, setBlogTitle] = useState(initialTitle || 'Your Amazing Blog Title');
  const [introduction, setIntroduction] = useState(parentIntroduction || '');
  const [sections, setSections] = useState<any[]>([]);
  const [isIntroductionLoading, setIsIntroductionLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<any>>(new Set());
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showIntroductionModal, setShowIntroductionModal] = useState(false);
  const [generatedIntroductions, setGeneratedIntroductions] = useState<string[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingIntro, setEditingIntro] = useState(false);
  const [titleMenuAnchor, setTitleMenuAnchor] = useState<HTMLElement | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [currentSectionId, setCurrentSectionId] = useState<string | number | null>(null);
  const sectionsRef = useRef(sections);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const introInputRef = useRef<HTMLInputElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const totalWords = useMemo(() =>
    sections.reduce((sum, s) => sum + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0),
    [sections]
  );

  const readingTime = useMemo(() => Math.max(1, Math.ceil(totalWords / 200)), [totalWords]);

  // Initialize markdown processor for preview functionality
  const sectionsForProcessor = useMemo(() => {
    const result: Record<string, string> = {};
    sections.forEach(s => {
      result[s.id] = s.content || '';
    });
    return result;
  }, [sections]);
  
  const { convertMarkdownToHTML } = useMarkdownProcessor(outline, sectionsForProcessor);

  // Track current section based on scroll position
  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sectionElements = container.querySelectorAll('[data-section-id]');
      let currentId: string | number | null = null;
      
      sectionElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 150) {
          currentId = el.getAttribute('data-section-id');
        }
      });
      
      if (currentId) {
        setCurrentSectionId(currentId);
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [sections]);

  // Navigate to section
  const handleNavigateToSection = useCallback((sectionId: string | number) => {
    const container = contentContainerRef.current;
    if (!container) return;
    
    const targetElement = container.querySelector(`[data-section-id="${sectionId}"]`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Match the key generation used by getPrimaryKeyForOutlineSection in useSEOManager
  const getOutlineKey = useCallback((section: any, index: number): string => {
    const raw = section?.id ?? section?.section_id ?? section?.sectionId ?? section?.sectionID ?? `section_${index + 1}`;
    return String(raw).trim();
  }, []);

  useEffect(() => {
    if (outline && outline.length > 0) {
      const initialSections = outline.map((section, index) => {
        const key = getOutlineKey(section, index);
        return {
          id: key,
          title: section.heading,
          content: parentSections?.[key] || parentSections?.[section.id] || parentSections?.[index + 1] || parentSections?.[`section_${index + 1}`] || section.key_points?.join(' ') || '',
          wordCount: section.target_words || 0,
          sources: section.references?.length || 0,
          outlineData: {
            subheadings: section.subheadings || [],
            keyPoints: section.key_points || [],
            keywords: section.keywords || [],
            references: section.references || [],
            targetWords: section.target_words || 0
          }
        };
      });
      setSections(initialSections);
    }
  }, [outline, parentSections, getOutlineKey]);

  const prevParentSectionsRef = useRef<string>('');
  const lastSyncKeyRef = useRef<number>(0);
  
  // Generate all candidate keys that getIdCandidatesForSection might produce
  const getSectionCandidates = useCallback((sectionId: string, index: number): string[] => {
    const candidates: string[] = [sectionId, sectionId.toLowerCase()];
    candidates.push(`section_${index + 1}`, `Section ${index + 1}`, `section${index + 1}`, `s${index + 1}`, `S${index + 1}`, `${index + 1}`);
    const asNum = Number(sectionId);
    if (!isNaN(asNum)) candidates.push(String(asNum));
    return Array.from(new Set(candidates));
  }, []);
  
  // Helper: sync local sections from parentSections, returns true if any content changed
  const syncFromParentSections = useCallback(() => {
    if (!parentSections || !outline || outline.length === 0) return false;
    const currentSections = sectionsRef.current;
    let didSync = false;
    const updatedSections = currentSections.map((section, index) => {
      const candidates = getSectionCandidates(String(section.id), index);
      let parentContent: string | undefined;
      for (const candidate of candidates) {
        if (parentSections[candidate] !== undefined) {
          parentContent = parentSections[candidate];
          break;
        }
      }
      if (parentContent !== undefined && parentContent !== section.content) {
        didSync = true;
        return { ...section, content: parentContent };
      }
      return section;
    });
    if (didSync) {
      setSections(updatedSections);
      if (onContentUpdate) {
        onContentUpdate(updatedSections);
      }
    }
    return didSync;
  }, [parentSections, outline, onContentUpdate, getSectionCandidates]);
  
  // Effect 1: sync when parentSections content reference changes
  useEffect(() => {
    if (!parentSections || !outline || outline.length === 0) return;
    const parentSectionsString = JSON.stringify(parentSections);
    if (parentSectionsString === prevParentSectionsRef.current) return;
    prevParentSectionsRef.current = parentSectionsString;
    const synced = syncFromParentSections();
    // Diagnostic: log key alignment between parentSections and outline-derived keys
    const parentKeys = Object.keys(parentSections);
    const outlineKeys = outline.map((s: any, i: number) => getOutlineKey(s, i));
    if (!synced) {
      debug.log('[BlogEditor] parentSections changed but sync found no updates', {
        parentKeys,
        outlineKeys,
        notInParent: outlineKeys.filter(k => !parentKeys.includes(k)),
        notInOutline: parentKeys.filter(k => !outlineKeys.includes(k)),
      });
    }
  }, [parentSections, syncFromParentSections]);
  
  // Sync introduction from parent when it changes
  useEffect(() => {
    if (parentIntroduction !== undefined && parentIntroduction !== introduction) {
      setIntroduction(parentIntroduction);
      debug.log('[BlogEditor] Introduction synced from parent', {
        length: parentIntroduction.length,
      });
    }
  }, [parentIntroduction]);

  // Effect 2: explicit forced sync via continuityRefresh (bypasses content-equality guard)
  useEffect(() => {
    if (continuityRefresh === undefined || continuityRefresh === 0) return;
    if (lastSyncKeyRef.current === continuityRefresh) return;
    lastSyncKeyRef.current = continuityRefresh;
    const synced = syncFromParentSections();
    debug.log('[BlogEditor] continuityRefresh sync', { key: continuityRefresh, synced });
  }, [continuityRefresh, syncFromParentSections]);

  useEffect(() => {
    if (initialTitle && initialTitle.trim().length > 0) {
      setBlogTitle(initialTitle);
    }
  }, [initialTitle]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingIntro && introInputRef.current) {
      introInputRef.current.focus();
      introInputRef.current.select();
    }
  }, [editingIntro]);

  const handleSuggestTitle = useCallback(() => {
    setShowTitleModal(true);
  }, []);

  const handleTitleAction = useCallback((action: string) => {
    switch (action) {
      case 'generate-titles':
      case 'research-titles':
        setShowTitleModal(true);
        break;
      case 'seo-optimize':
      case 'ab-test':
        break;
    }
  }, []);

  const handleTitleSelect = useCallback((selectedTitle: string) => {
    setBlogTitle(selectedTitle);
    setShowTitleModal(false);
  }, []);

  const handleGenerateIntroductions = useCallback(async () => {
    if (!research || !outline.length || isIntroductionLoading) return;

    setIsIntroductionLoading(true);
    try {
      const keywordAnalysis = research.keyword_analysis || {};
      const primaryKeywords = keywordAnalysis.primary || [];
      const searchIntent = keywordAnalysis.search_intent || 'informational';

      const sectionsContent: Record<string, string> = {};
      sections.forEach(section => {
        if (section.content) {
          sectionsContent[section.id] = section.content;
        }
      });

      const result = await blogWriterApi.generateIntroductions({
        blog_title: blogTitle,
        research,
        outline,
        sections_content: sectionsContent,
        primary_keywords: primaryKeywords,
        search_intent: searchIntent
      });

      if (result.success && result.introductions) {
        setGeneratedIntroductions(result.introductions);
        setShowIntroductionModal(true);
      }
    } catch (error) {
      console.error('Failed to generate introductions:', error);
    } finally {
      setIsIntroductionLoading(false);
    }
  }, [research, outline, sections, blogTitle, isIntroductionLoading]);

  const handleIntroductionSelect = useCallback((selectedIntroduction: string) => {
    setIntroduction(selectedIntroduction);
    onIntroductionUpdate?.(selectedIntroduction);
    setShowIntroductionModal(false);
  }, [onIntroductionUpdate]);

  const toggleSectionExpansion = useCallback((sectionId: any) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) newSet.delete(sectionId);
      else newSet.add(sectionId);
      return newSet;
    });
  }, []);

  const handleDeleteSection = useCallback((sectionId: any) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    if (onContentUpdate) {
      // Update parent with filtered sections
      setTimeout(() => {
        // Give React time to update state
      }, 0);
    }
  }, [onContentUpdate]);

  return (
    <ThemeProvider theme={theme}>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-[2%] py-6">
          <div className="flex gap-8">
            {/* Main editor column */}
            <div className="flex-1 min-w-0 max-w-4xl" ref={contentContainerRef}>
              <Paper elevation={0} className="bg-white p-8 md:p-10 rounded-xl border border-gray-200/60">
                {/* Title */}
                <div className="mb-6 pb-6 border-b border-gray-100" data-section-id="title">
                  <div className="flex items-start gap-2 group">
                    {editingTitle ? (
                      <TextField
                        inputRef={titleInputRef}
                        fullWidth
                        variant="standard"
                        value={blogTitle}
                        onChange={(e) => setBlogTitle(e.target.value)}
                        onBlur={() => setEditingTitle(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingTitle(false);
                          if (e.key === 'Escape') setEditingTitle(false);
                        }}
                        InputProps={{
                          disableUnderline: true,
                          className: 'text-2xl md:text-4xl font-bold font-serif text-gray-900 leading-tight min-w-0',
                        }}
                      />
                    ) : (
                      <h1
                        className="flex-1 min-w-0 text-2xl md:text-4xl font-bold font-serif text-gray-900 leading-tight cursor-text hover:bg-gray-50/50 px-2 -ml-2 py-1 rounded transition-colors duration-150"
                        onClick={() => setEditingTitle(true)}
                      >
                        {blogTitle}
                      </h1>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1 shrink-0 flex items-center gap-1">
                      <Tooltip title="Preview full blog">
                        <IconButton onClick={() => setShowPreviewModal(true)} size="small">
                          <VisibilityIcon className="text-green-600" fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Title actions">
                        <IconButton size="small" onClick={(e) => setTitleMenuAnchor(e.currentTarget)}>
                          <MoreHorizIcon className="text-gray-400" fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Choose from AI titles">
                        <IconButton onClick={handleSuggestTitle} size="small">
                          <AutoAwesomeIcon className="text-purple-500" fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </div>
                    <HoverMenu
                      anchorEl={titleMenuAnchor}
                      open={Boolean(titleMenuAnchor)}
                      onClose={() => setTitleMenuAnchor(null)}
                      type="title"
                      onAction={handleTitleAction}
                    />
                  </div>

                  {/* Introduction */}
                  <div className="mt-4 group/intro" data-section-id="intro">
                    <div className="flex items-start gap-2">
                      {editingIntro ? (
                        <TextField
                          inputRef={introInputRef}
                          fullWidth
                          variant="standard"
                          multiline
                          minRows={2}
                          value={introduction}
                          onChange={(e) => {
                            setIntroduction(e.target.value);
                            onIntroductionUpdate?.(e.target.value);
                          }}
                          onBlur={() => setEditingIntro(false)}
                          placeholder="Write an engaging introduction..."
                          InputProps={{
                            disableUnderline: true,
                            className: 'text-base text-gray-600 leading-relaxed',
                          }}
                        />
                      ) : (
                        <p
                          className={`flex-1 text-base leading-relaxed cursor-text hover:bg-gray-50/50 px-2 -ml-2 py-1 rounded transition-colors duration-150 ${
                            introduction ? 'text-gray-600' : 'text-gray-400'
                          }`}
                          onClick={() => setEditingIntro(true)}
                        >
                          {introduction || 'Click to write your introduction...'}
                        </p>
                      )}
                      <div className="opacity-0 group-hover/intro:opacity-100 transition-opacity duration-200 shrink-0">
                        <Tooltip title="Generate Introduction">
                          <IconButton
                            onClick={handleGenerateIntroductions}
                            disabled={isIntroductionLoading || !research || !outline.length}
                            size="small"
                          >
                            {isIntroductionLoading ? (
                              <CircularProgress size={18} />
                            ) : (
                              <AutoAwesomeIcon className="text-blue-500" fontSize="small"/>
                            )}
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-1">
                  {sections.map((section, index) => {
                    const imageIdByIndex = outline[index]?.id;
                    const outlineSection = outline.find(s => (s.id === section.id) || (s.heading === section.title));
                    const imageId = imageIdByIndex || outlineSection?.id || section.id;
                    const sectionImage = sectionImages?.[imageId] || null;
                    return (
                      <div key={section.id} data-section-id={section.id}>
                        <BlogSection 
                          {...section} 
                          onContentUpdate={onContentUpdate}
                          onDeleteSection={handleDeleteSection}
                          expandedSections={expandedSections}
                          toggleSectionExpansion={toggleSectionExpansion}
                          refreshToken={continuityRefresh}
                          flowAnalysisResults={flowAnalysisResults}
                          sectionImage={sectionImage}
                          convertMarkdownToHTML={convertMarkdownToHTML}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Compact Stats Bar - Vertical Stack */}
                <Paper elevation={0} sx={{ 
                  mt: 4, 
                  p: 2, 
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  bgcolor: 'linear-gradient(135deg, #fafbfc 0%, #f1f5f9 100%)',
                  background: 'linear-gradient(135deg, #fafbfc 0%, #f1f5f9 100%)',
                }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {/* Left: Stats */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Tooltip title="Total sections in your blog">
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4f46e5', cursor: 'help' }}>
                            📊 {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                          </span>
                        </Tooltip>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <Tooltip title="Total word count across all sections">
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563eb', cursor: 'help' }}>
                            📝 {totalWords.toLocaleString()} words
                          </span>
                        </Tooltip>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <Tooltip title="Estimated reading time (200 words/minute)">
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#d97706', cursor: 'help' }}>
                            ⏱️ {readingTime} min read
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                    
                    {/* Right: Circular Progress + Play All TTS */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {(() => {
                      const targetWords = sections.reduce((s, sec) => s + (sec.outlineData?.targetWords || 500), 0);
                      const progress = targetWords > 0 ? Math.min(100, Math.round((totalWords / targetWords) * 100)) : 0;
                      const remaining = Math.max(0, targetWords - totalWords);
                      
                      return (
                        <Tooltip 
                          title={
                            <div style={{ padding: 4 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Writing Progress</div>
                              <div style={{ fontSize: '0.75rem' }}>
                                ✅ Completed: {totalWords.toLocaleString()} words<br/>
                                🎯 Target: {targetWords.toLocaleString()} words<br/>
                                📝 Remaining: {remaining.toLocaleString()} words<br/>
                                📊 Progress: {progress}%
                              </div>
                            </div>
                          }
                          arrow
                          placement="top"
                        >
                          <div style={{ position: 'relative', width: 56, height: 56, cursor: 'help' }}>
                            <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="#e2e8f0"
                                strokeWidth="4"
                              />
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke={progress >= 90 ? '#10b981' : '#6366f1'}
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 24}`}
                                strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                              />
                            </svg>
                            <span style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: progress >= 90 ? '#10b981' : '#6366f1',
                            }}>
                              {progress}%
                            </span>
                          </div>
                        </Tooltip>
                      );
                    })()}
                      
                      {/* Play All TTS Button */}
                      <PlayAllTTSButton
                        title={blogTitle}
                        introduction={introduction}
                        sections={sections.map(s => ({ title: s.title, content: s.content }))}
                      />
                    </div>
                  </div>
                  
                  {/* Research Tools - Compact Chips */}
                  {(research || sourceMappingStats || groundingInsights) && (
                    <div style={{ 
                      marginTop: 8, 
                      paddingTop: 8, 
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex', 
                      gap: 4, 
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginRight: 4 }}>
                        🔬 Research Tools:
                      </span>
                      {research && (
                        <Chip 
                          icon={<BarChartIcon />} 
                          label="Keywords" 
                          size="small"
                          onClick={() => console.log('Open keywords')}
                          sx={{ 
                            height: 24, 
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#e0e7ff' },
                          }}
                        />
                      )}
                      {sourceMappingStats && (
                        <Chip 
                          icon={<HubIcon />} 
                          label={`Sources (${sourceMappingStats.total_sources || 0})`} 
                          size="small"
                          onClick={() => console.log('Open sources')}
                          sx={{ 
                            height: 24, 
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#dbeafe' },
                          }}
                        />
                      )}
                      {groundingInsights && (
                        <Chip 
                          icon={<FactCheckIcon />} 
                          label="Grounding" 
                          size="small"
                          onClick={() => console.log('Open grounding')}
                          sx={{ 
                            height: 24, 
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#fef3c7' },
                          }}
                        />
                      )}
                    </div>
                  )}
                </Paper>
              </Paper>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-6">
                <EditorSidebar sections={sections} totalWords={totalWords} />
              </div>
            </div>
          </div>
        </div>

        {/* On This Page Navigation */}
        <OnThisPageNav
          title={blogTitle}
          introduction={introduction}
          sections={sections}
          onNavigate={handleNavigateToSection}
          currentSectionId={currentSectionId}
        />

        {/* Title Selection Modal */}
        <Dialog open={showTitleModal} onClose={() => setShowTitleModal(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Choose Your Blog Title
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {researchTitles.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                    Research-Based Titles
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {researchTitles.map((title, index) => (
                      <Button
                        key={index}
                        variant="outlined"
                        fullWidth
                        onClick={() => handleTitleSelect(title)}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1.5, px: 2 }}
                      >
                        {title}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
              {aiGeneratedTitles.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: 'secondary.main' }}>
                    AI Generated Titles
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {aiGeneratedTitles.map((title, index) => (
                      <Button
                        key={index}
                        variant="outlined"
                        fullWidth
                        onClick={() => handleTitleSelect(title)}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1.5, px: 2 }}
                      >
                        {title}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
              {titleOptions.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, color: 'success.main' }}>
                    Additional Options
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {titleOptions.map((title, index) => (
                      <Button
                        key={index}
                        variant="outlined"
                        fullWidth
                        onClick={() => handleTitleSelect(title)}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1.5, px: 2 }}
                      >
                        {title}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
              {researchTitles.length === 0 && aiGeneratedTitles.length === 0 && titleOptions.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No title options available. Please generate an outline first.
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTitleModal(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Introduction Selection Modal */}
        <Dialog open={showIntroductionModal} onClose={() => setShowIntroductionModal(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Choose Your Blog Introduction
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              Select one of the AI-generated introductions below.
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {generatedIntroductions.map((intro, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 3, p: 2,
                    border: '1px solid',
                    borderColor: index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'success.main',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                  onClick={() => handleIntroductionSelect(intro)}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'success.main' }}>
                    {index === 0 ? 'Problem-Focused' : index === 1 ? 'Benefit-Focused' : 'Story/Statistic-Focused'}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {intro}
                  </Typography>
                </Box>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowIntroductionModal(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Full Blog Preview Modal */}
        <BlogPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title={blogTitle}
          introduction={introduction}
          sections={sections.map(s => ({
            title: s.title,
            content: s.content,
          }))}
          convertMarkdownToHTML={convertMarkdownToHTML}
        />
      </div>
    </ThemeProvider>
  );
};

export default BlogEditor;
