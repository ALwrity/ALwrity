import { useState, useEffect, useCallback } from 'react';
import { BlogOutlineSection, BlogResearchResponse, BlogSEOMetadataResponse, BlogSEOAnalyzeResponse, SourceMappingStats, GroundingInsights, ResearchCoverage } from '../services/blogWriterApi';
import { researchCache } from '../services/researchCache';
import { blogWriterCache } from '../services/blogWriterCache';
import { computeContentFingerprint, hashSectionContent } from '../utils/contentHash';

const MINOR_TITLE_WORDS = new Set([
  'a', 'an', 'and', 'or', 'but', 'the', 'for', 'nor', 'on', 'at', 'to', 'from', 'by',
  'of', 'in', 'with', 'as', 'vs', 'vs.', 'into', 'over', 'under'
]);

// Helper: read and parse localStorage synchronously (safe for useState initializer)
const readLS = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const readLSString = (key: string, fallback: string): string => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? raw : fallback;
  } catch {
    return fallback;
  }
};

// Compute a content fingerprint from the outline to detect stale SEO metadata.
// The fingerprint changes whenever the blog structure (outline IDs + title) changes,
// which means any previously cached SEO metadata is no longer valid.
const computeMetadataFingerprint = (outline: BlogOutlineSection[], selectedTitle: string): string => {
  const ids = outline.map(s => String(s.id)).sort().join(',');
  return `${ids}|${selectedTitle}`;
};

const readLSBool = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? raw === 'true' : fallback;
  } catch {
    return fallback;
  }
};

// Perform synchronous restoration from localStorage/caches so that
// phase-navigation hooks see real data on the very first render.
const restoreInitialState = () => {
  let research: BlogResearchResponse | null = null;
  let outline: BlogOutlineSection[] = [];
  let titleOptions: string[] = [];
  let selectedTitle: string = '';
  let sections: Record<string, string> = {};
  let seoAnalysis: BlogSEOAnalyzeResponse | null = null;
  let seoMetadata: BlogSEOMetadataResponse | null = null;
  let flowAnalysisResults: any = null;
  let flowAnalysisCompleted: boolean = false;
  let outlineConfirmed: boolean = false;
  let contentConfirmed: boolean = false;
  let sourceMappingStats: SourceMappingStats | null = null;
  let groundingInsights: GroundingInsights | null = null;
  let researchCoverage: ResearchCoverage | null = null;
  let sectionImages: Record<string, string> = {};

  try {
    // Restore research from the research cache (synchronous localStorage reads)
    const cachedEntries = researchCache.getAllCachedEntries();
    if (cachedEntries.length > 0) {
      research = cachedEntries[0].result;
    }

    // Restore outline from localStorage
    const savedOutline = readLS<BlogOutlineSection[] | null>('blog_outline', null);
    if (savedOutline && savedOutline.length > 0) {
      outline = savedOutline;

      // Restore content sections from cache
      const outlineIds = savedOutline.map((s: any) => String(s.id));
      const cachedContent = blogWriterCache.getCachedContent(outlineIds);
      if (cachedContent && Object.keys(cachedContent).length > 0) {
        sections = cachedContent;
      }
    }

    // Restore titles — strip any stale '...' truncation baked in by prior versions
    titleOptions = readLS<string[]>('blog_title_options', []).map(t => t.replace(/\.\.\.$/, ''));
    selectedTitle = readLSString('blog_selected_title', '').replace(/\.\.\.$/, '');

    // Restore outline intelligence metadata
    sourceMappingStats = readLS<SourceMappingStats | null>('blog_source_mapping_stats', null);
    groundingInsights = readLS<GroundingInsights | null>('blog_grounding_insights', null);
    researchCoverage = readLS<ResearchCoverage | null>('blog_research_coverage', null);

    // Restore confirmation flags
    outlineConfirmed = readLSBool('blog_outline_confirmed', false);
    contentConfirmed = readLSBool('blog_content_confirmed', false);
    // Only restore outline/content confirmation from explicit flags.
    // Previously, backward compat assumed confirmed if data existed, but this
    // caused premature phase advancement (e.g. jumping to SEO phase on page load)
    // when restoring stale cached data from a prior session.

    // Restore SEO data
    seoAnalysis = readLS<BlogSEOAnalyzeResponse | null>('blog_seo_analysis', null);
    seoMetadata = readLS<BlogSEOMetadataResponse | null>('blog_seo_metadata', null);

    // Validate SEO metadata against current outline — discard if stale
    if (seoMetadata) {
      if (outline.length === 0) {
        // No outline context — metadata is meaningless for a fresh blog
        seoMetadata = null;
        try { localStorage.removeItem('blog_seo_metadata'); } catch {}
      } else {
        const savedFingerprint = readLS<string | null>('blog_seo_metadata_fingerprint', null);
        const currentFingerprint = computeMetadataFingerprint(outline, selectedTitle);
        if (savedFingerprint !== currentFingerprint) {
          // Outline or title changed since metadata was generated — discard stale data
          seoMetadata = null;
          try { localStorage.removeItem('blog_seo_metadata'); } catch {}
          try { localStorage.removeItem('blog_seo_metadata_fingerprint'); } catch {}
        }
      }
    }

    // Restore flow analysis results — discard if section content has changed
    // since they were generated (the per-section content hash is part of the
    // fingerprint, unlike SEO metadata which only depends on outline shape).
    flowAnalysisResults = readLS<any>('blog_flow_analysis', null);
    flowAnalysisCompleted = readLSBool('blog_flow_analysis_completed', false);
    if (flowAnalysisResults) {
      if (outline.length === 0 || Object.keys(sections).length === 0) {
        flowAnalysisResults = null;
        flowAnalysisCompleted = false;
        try { localStorage.removeItem('blog_flow_analysis'); } catch {}
        try { localStorage.removeItem('blog_flow_analysis_completed'); } catch {}
      } else {
        const savedFingerprint = readLS<string | null>('blog_flow_analysis_fingerprint', null);
        const contentHashesById: Record<string, string> = {};
        for (const id of Object.keys(sections)) {
          contentHashesById[id] = hashSectionContent(sections[id]);
        }
        const currentFingerprint = computeContentFingerprint(
          outline.map(s => s.id),
          selectedTitle,
          contentHashesById,
        );
        if (savedFingerprint !== currentFingerprint) {
          // Content edited since analysis — discard stale results
          flowAnalysisResults = null;
          flowAnalysisCompleted = false;
          try { localStorage.removeItem('blog_flow_analysis'); } catch {}
          try { localStorage.removeItem('blog_flow_analysis_fingerprint'); } catch {}
          try { localStorage.removeItem('blog_flow_analysis_completed'); } catch {}
        }
      }
    }

    // Restore section images (log only once per session, not on every hook mount)
    const savedSectionImages = readLS<Record<string, string> | null>('blog_section_images', null);
    if (savedSectionImages && Object.keys(savedSectionImages).length > 0) {
      sectionImages = savedSectionImages;
      if (!(window as any).__sectionImagesLogged) {
        console.log(`[SectionImages] Restored ${Object.keys(sectionImages).length} images from localStorage`);
        (window as any).__sectionImagesLogged = true;
      }
    }
  } catch (error) {
    console.error('Error during initial state restoration:', error);
  }

  return {
    research,
    outline,
    titleOptions,
    selectedTitle,
    sections,
    seoAnalysis,
    seoMetadata,
    flowAnalysisResults,
    flowAnalysisCompleted,
    outlineConfirmed,
    contentConfirmed,
    sourceMappingStats,
    groundingInsights,
    researchCoverage,
    sectionImages,
  };
};

export const useBlogWriterState = () => {
  // Restore initial state synchronously from localStorage (like StoryWriter pattern)
  // This ensures phase-navigation hooks see real data on the first render,
  // preventing unwanted redirects during the async restoration gap.
  const initialState = restoreInitialState();

  // Core state — initialized from localStorage when available
  const [research, setResearch] = useState<BlogResearchResponse | null>(initialState.research);
  const [outline, setOutline] = useState<BlogOutlineSection[]>(initialState.outline);
  const [titleOptions, setTitleOptions] = useState<string[]>(initialState.titleOptions);
  const [selectedTitle, setSelectedTitle] = useState<string>(initialState.selectedTitle);
  const [sections, setSections] = useState<Record<string, string>>(initialState.sections);
  const [seoAnalysis, setSeoAnalysis] = useState<BlogSEOAnalyzeResponse | null>(initialState.seoAnalysis);
  const [genMode, setGenMode] = useState<'draft' | 'polished'>('polished');
  const [seoMetadata, setSeoMetadata] = useState<BlogSEOMetadataResponse | null>(initialState.seoMetadata);
  const [introduction, setIntroduction] = useState<string>(localStorage.getItem('blog_introduction') || '');
  const [continuityRefresh, setContinuityRefresh] = useState<number>(0);
  const [outlineTaskId, setOutlineTaskId] = useState<string | null>(null);
  const [flowAnalysisCompleted, setFlowAnalysisCompleted] = useState<boolean>(initialState.flowAnalysisCompleted);
  const [flowAnalysisResults, setFlowAnalysisResults] = useState<any>(initialState.flowAnalysisResults);
  
  // Enhanced metadata state
  const [sourceMappingStats, setSourceMappingStats] = useState<SourceMappingStats | null>(initialState.sourceMappingStats);
  const [groundingInsights, setGroundingInsights] = useState<GroundingInsights | null>(initialState.groundingInsights);
  const [researchCoverage, setResearchCoverage] = useState<ResearchCoverage | null>(initialState.researchCoverage);
  
  // Separate research titles from AI-generated titles
  const [researchTitles, setResearchTitles] = useState<string[]>([]);
  const [aiGeneratedTitles, setAiGeneratedTitles] = useState<string[]>([]);
  
  // Outline confirmation state
  const [outlineConfirmed, setOutlineConfirmed] = useState<boolean>(initialState.outlineConfirmed);
  
  // Content confirmation state
  const [contentConfirmed, setContentConfirmed] = useState<boolean>(initialState.contentConfirmed);

  // Section images state - persists images generated in outline phase to content phase
  const [sectionImages, setSectionImages] = useState<Record<string, string>>(initialState.sectionImages);

  const formatContentAngleToTitle = useCallback((angle: string): string => {
    if (!angle || typeof angle !== 'string') {
      return '';
    }
    const cleaned = angle.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return '';
    }

    const words = cleaned.split(' ');
    const formattedWords = words.map((word, index) => {
      const lower = word.toLowerCase();
      if (index !== 0 && MINOR_TITLE_WORDS.has(lower)) {
        return lower;
      }
      if (!lower) {
        return '';
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).filter(Boolean);

    let formatted = formattedWords.join(' ');
    return formatted;
  }, []);

  const dedupeTitles = useCallback((titles: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    titles.forEach((title) => {
      if (!title) {
        return;
      }
      const normalized = title.replace(/\s+/g, ' ').trim();
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      result.push(normalized);
    });

    return result;
  }, []);

  const [restoreAttempted] = useState(true); // Always true — state is restored synchronously

  // Persist contentConfirmed to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('blog_content_confirmed', String(contentConfirmed));
    } catch {}
  }, [contentConfirmed]);

  // Persist outlineConfirmed to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('blog_outline_confirmed', String(outlineConfirmed));
    } catch {}
  }, [outlineConfirmed]);

  // Persist seoAnalysis to localStorage whenever it changes
  useEffect(() => {
    try {
      if (seoAnalysis) {
        localStorage.setItem('blog_seo_analysis', JSON.stringify(seoAnalysis));
      }
    } catch {}
  }, [seoAnalysis]);

  // Persist seoMetadata + content fingerprint to localStorage whenever they change
  useEffect(() => {
    try {
      if (seoMetadata) {
        localStorage.setItem('blog_seo_metadata', JSON.stringify(seoMetadata));
        // Save fingerprint to detect staleness on future page loads
        const fingerprint = computeMetadataFingerprint(outline, selectedTitle);
        localStorage.setItem('blog_seo_metadata_fingerprint', fingerprint);
      } else {
        // Clear both when metadata is explicitly nulled
        localStorage.removeItem('blog_seo_metadata');
        localStorage.removeItem('blog_seo_metadata_fingerprint');
      }
    } catch {}
  }, [seoMetadata, outline, selectedTitle]);

  // Persist flow analysis results + content fingerprint to localStorage
  // whenever they change. The fingerprint includes per-section content hashes
  // so any edit to a section invalidates the cached results on the next load.
  useEffect(() => {
    try {
      if (flowAnalysisResults) {
        localStorage.setItem('blog_flow_analysis', JSON.stringify(flowAnalysisResults));
        const contentHashesById: Record<string, string> = {};
        for (const id of Object.keys(sections)) {
          contentHashesById[id] = hashSectionContent(sections[id]);
        }
        const fingerprint = computeContentFingerprint(
          outline.map(s => s.id),
          selectedTitle,
          contentHashesById,
        );
        localStorage.setItem('blog_flow_analysis_fingerprint', fingerprint);
      } else {
        localStorage.removeItem('blog_flow_analysis');
        localStorage.removeItem('blog_flow_analysis_fingerprint');
      }
      if (flowAnalysisCompleted) {
        localStorage.setItem('blog_flow_analysis_completed', 'true');
      } else {
        localStorage.removeItem('blog_flow_analysis_completed');
      }
    } catch {}
  }, [flowAnalysisResults, flowAnalysisCompleted, sections, outline, selectedTitle]);

  // Persist sectionImages to localStorage whenever they change
  useEffect(() => {
    try {
      if (Object.keys(sectionImages).length > 0) {
        const serialized = JSON.stringify(sectionImages);
        // Warn if approaching localStorage quota (~5MB)
        if (serialized.length > 4_000_000) {
          console.warn(`[SectionImages] Approaching localStorage quota: ${(serialized.length / 1024 / 1024).toFixed(1)}MB`);
        }
        localStorage.setItem('blog_section_images', serialized);
      } else {
        // Only remove if we have previously saved images (avoid clearing on transient empty state)
        if (localStorage.getItem('blog_section_images')) {
          localStorage.removeItem('blog_section_images');
        }
      }
    } catch (e) {
      console.warn('[SectionImages] Failed to persist to localStorage via effect:', e);
    }
  }, [sectionImages]);

  // Persist introduction to localStorage whenever it changes
  useEffect(() => {
    try {
      if (introduction) {
        localStorage.setItem('blog_introduction', introduction);
      }
    } catch {}
  }, [introduction]);

  // Persist sections to blogWriterCache whenever they change
  useEffect(() => {
    const outlineIds = outline.map(s => String(s.id));
    if (outlineIds.length > 0 && Object.keys(sections).length > 0) {
      const normalized: Record<string, string> = {};
      const values = Object.values(sections);
      outline.forEach((s, idx) => {
        const id = String(s.id);
        normalized[id] = sections[id] ?? values[idx] ?? '';
      });
      blogWriterCache.cacheContent(normalized, outlineIds);
    }
  }, [sections, outline]);

  // Handle research completion
  const handleResearchComplete = useCallback((researchData: BlogResearchResponse) => {
    // New research topic — any prior SEO metadata + flow analysis are now stale
    setSeoMetadata(null);
    setFlowAnalysisResults(null);
    setFlowAnalysisCompleted(false);

    setResearch(researchData);
    const formattedAngles = dedupeTitles(
      (researchData?.suggested_angles || []).map(formatContentAngleToTitle)
    );
    setResearchTitles(formattedAngles);

    // Prefill title from research if no title is currently selected
    if (!selectedTitle && formattedAngles.length > 0) {
      const firstTitle = formattedAngles[0];
      setSelectedTitle(firstTitle);
      localStorage.setItem('blog_selected_title', firstTitle);
    }
  }, [dedupeTitles, formatContentAngleToTitle, selectedTitle]);

  // Handle outline completion with enhanced metadata
  const handleOutlineComplete = useCallback((result: any) => {
    if (result?.outline) {
      // New content structure — any prior SEO metadata + flow analysis are now stale
      setSeoMetadata(null);
      setFlowAnalysisResults(null);
      setFlowAnalysisCompleted(false);

      setOutline(result.outline);

      const aiTitleOptions: string[] = result.title_options || [];
      const formattedAngles = dedupeTitles(
        (research?.suggested_angles || []).map(formatContentAngleToTitle)
      );
      const combinedTitleOptions = dedupeTitles([
        ...formattedAngles,
        ...aiTitleOptions
      ]);

      setTitleOptions(combinedTitleOptions);
      setResearchTitles(formattedAngles);

      const aiTitlesList = dedupeTitles(
        aiTitleOptions.filter((title: string) => !formattedAngles.some(angle => angle.toLowerCase() === (title || '').toLowerCase().trim()))
      );
      setAiGeneratedTitles(aiTitlesList);

      const nextSelectedTitle = aiTitlesList[0] || formattedAngles[0] || combinedTitleOptions[0] || '';
      if (nextSelectedTitle) {
        setSelectedTitle(nextSelectedTitle);
      }

      // Store enhanced metadata
      if (result.source_mapping_stats) {
        setSourceMappingStats(result.source_mapping_stats);
      }
      if (result.grounding_insights) {
        setGroundingInsights(result.grounding_insights);
      }
      if (result.research_coverage) {
        setResearchCoverage(result.research_coverage);
      }

      // Save to localStorage for persistence (using shared cache utility)
      try {
        const { blogWriterCache } = require('../services/blogWriterCache');
        blogWriterCache.cacheOutline(result.outline, combinedTitleOptions);
        localStorage.setItem('blog_title_options', JSON.stringify(combinedTitleOptions));
        localStorage.setItem('blog_selected_title', nextSelectedTitle || '');
        localStorage.setItem('blog_source_mapping_stats', JSON.stringify(result.source_mapping_stats || null));
        localStorage.setItem('blog_grounding_insights', JSON.stringify(result.grounding_insights || null));
        localStorage.setItem('blog_research_coverage', JSON.stringify(result.research_coverage || null));
        console.log('Saved outline data to localStorage');
      } catch (error) {
        console.error('Error saving outline data:', error);
      }
    }
    setOutlineTaskId(null);
    // Reset outline confirmation when new outline is generated
    setOutlineConfirmed(false);
  }, [research, dedupeTitles, formatContentAngleToTitle]);

  // Handle outline error
  const handleOutlineError = useCallback((error: any) => {
    console.error('Outline generation error:', error);
    setOutlineTaskId(null);
  }, []);

  // Handle section generation
  const handleSectionGenerated = useCallback((sectionId: string, markdown: string) => {
    setSections(prev => ({ ...prev, [sectionId]: markdown }));
  }, []);

  // Handle continuity refresh
  const handleContinuityRefresh = useCallback(() => {
    setContinuityRefresh(Date.now());
  }, []);

  // Handle title selection
  const handleTitleSelect = useCallback((title: string) => {
    setSelectedTitle(title);
    localStorage.setItem('blog_selected_title', title);
  }, []);

  // Handle custom title
  const handleCustomTitle = useCallback((title: string) => {
    const newTitleOptions = [...titleOptions, title];
    setTitleOptions(newTitleOptions);
    setSelectedTitle(title);
    localStorage.setItem('blog_title_options', JSON.stringify(newTitleOptions));
    localStorage.setItem('blog_selected_title', title);
  }, [titleOptions]);

  // Handle outline confirmation
  const handleOutlineConfirmed = useCallback(() => {
    setOutlineConfirmed(true);
    console.log('Outline confirmed by user');
  }, []);

  // Handle outline refinement
  const handleOutlineRefined = useCallback((feedback: string) => {
    console.log('Outline refinement requested with feedback:', feedback);
    // The actual refinement will be handled by the copilot action
  }, []);

  // Handle content updates from WYSIWYG editor
  const handleContentUpdate = useCallback((updatedSections: any[]) => {
    console.log('Content updated:', updatedSections);
    // Update sections state with new content
    const newSections: { [key: string]: string } = {};
    updatedSections.forEach(section => {
      newSections[section.id] = section.content;
    });
    setSections(newSections);
  }, [setSections]);

  // Handle content saving
  const handleContentSave = useCallback((content: any) => {
    console.log('Content saved:', content);
    // Here you could save to backend or local storage
    // For now, just log the content
  }, []);

  // Restore full blog state from a loaded BlogAssetFull object
  const restoreFromAsset = useCallback((asset: any) => {
    if (!asset) return;
    try {
      // Restore research
      if (asset.research_data) {
        setResearch(asset.research_data);
        localStorage.setItem('blog_research_cache', JSON.stringify(asset.research_data));
      }

      // Restore outline
      if (asset.outline_data) {
        const od = asset.outline_data;
        if (od.outline && Array.isArray(od.outline)) {
          setOutline(od.outline);
          localStorage.setItem('blog_outline', JSON.stringify(od.outline));
        }
        if (od.selected_title) {
          setSelectedTitle(od.selected_title);
          localStorage.setItem('blog_selected_title', od.selected_title);
        }
        if (od.title_options && Array.isArray(od.title_options)) {
          setTitleOptions(od.title_options);
          localStorage.setItem('blog_title_options', JSON.stringify(od.title_options));
        }
        setOutlineConfirmed(true);
        localStorage.setItem('blog_outline_confirmed', 'true');
      }

      // Restore content sections
      if (asset.content_data && typeof asset.content_data === 'object') {
        const sectionsMap: Record<string, string> = {};
        Object.entries(asset.content_data).forEach(([key, value]) => {
          if (typeof value === 'string') {
            sectionsMap[key] = value;
          }
        });
        if (Object.keys(sectionsMap).length > 0) {
          setSections(sectionsMap);
          setContentConfirmed(true);
          localStorage.setItem('blog_content_confirmed', 'true');
          // Also write to the blog writer cache
          try {
            const cacheKey = 'blogwriter_content_' + JSON.stringify(Object.keys(sectionsMap));
            localStorage.setItem(cacheKey, JSON.stringify(sectionsMap));
          } catch {}
        }
      }

      // Restore SEO
      if (asset.seo_data) {
        const sd = asset.seo_data;
        if (sd.analysis) {
          setSeoAnalysis(sd.analysis);
          localStorage.setItem('blog_seo_analysis', JSON.stringify(sd.analysis));
        }
        if (sd.metadata) {
          setSeoMetadata(sd.metadata);
          localStorage.setItem('blog_seo_metadata', JSON.stringify(sd.metadata));
        }
        if (sd.recommendations_applied) {
          localStorage.setItem('blog_seo_recommendations_applied', 'true');
        }
      }

      // Restore publish completion
      if (asset.publish_data) {
        localStorage.setItem('blog_publish_completed', 'true');
      }

      // Note: Intentionally NOT writing the asset's phase to localStorage here.
      // The user's actual phase from their previous session (persisted by
      // usePhaseNavigationCore) is more reliable. Writing 'research' here would
      // overwrite it and cause usePhaseRestoration to restore the stale phase.

      console.log('[BlogWriterState] Restored from asset:', asset.id, 'phase:', asset.phase || 'research');
    } catch (e) {
      console.error('[BlogWriterState] Failed to restore from asset:', e);
    }
  }, []);

  return {
    // State
    research,
    outline,
    titleOptions,
    selectedTitle,
    sections,
    introduction,
    seoAnalysis,
    genMode,
    seoMetadata,
    continuityRefresh,
    outlineTaskId,
    sourceMappingStats,
    groundingInsights,
    researchCoverage,
    researchTitles,
    aiGeneratedTitles,
    outlineConfirmed,
    contentConfirmed,
    flowAnalysisCompleted,
    flowAnalysisResults,
    sectionImages,
    restoreAttempted,
    
    // Setters
    setResearch,
    setOutline,
    setTitleOptions,
    setSelectedTitle,
    setSections,
    setIntroduction,
    setSeoAnalysis,
    setGenMode,
    setSeoMetadata,
    setContinuityRefresh,
    setOutlineTaskId,
    setSourceMappingStats,
    setGroundingInsights,
    setResearchCoverage,
    setResearchTitles,
    setAiGeneratedTitles,
    setOutlineConfirmed,
    setContentConfirmed,
    setFlowAnalysisCompleted,
    setFlowAnalysisResults,
    setSectionImages,
    
    // Handlers
    handleResearchComplete,
    handleOutlineComplete,
    handleOutlineError,
    handleSectionGenerated,
    handleContinuityRefresh,
    handleTitleSelect,
    handleCustomTitle,
    handleOutlineConfirmed,
    handleOutlineRefined,
    handleContentUpdate,
    handleContentSave,

    // Asset restoration
    restoreFromAsset
  };
};
