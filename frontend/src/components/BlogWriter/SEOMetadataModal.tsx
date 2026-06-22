/**
 * SEO Metadata Modal Component
 * 
 * Comprehensive SEO metadata generation and editing interface with:
 * - Tabbed interface for different metadata types
 * - Live preview of social media cards
 * - Character counters and validation
 * - Copy-to-clipboard functionality
 * - Integration with backend metadata generation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Preview as PreviewIcon,
  Search as SearchIcon,
  Share as ShareIcon,
  Code as CodeIcon,
  Tag as TagIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { aiApiClient, triggerSubscriptionError } from '../../api/client';

// Import metadata display components
import { CoreMetadataTab } from './SEO/MetadataDisplay/CoreMetadataTab';
import { SocialMediaTab } from './SEO/MetadataDisplay/SocialMediaTab';
import { StructuredDataTab } from './SEO/MetadataDisplay/StructuredDataTab';
import { PreviewCard } from './SEO/MetadataDisplay/PreviewCard';
import { subscribeImage } from '../../utils/imageBus';

interface SEOMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  blogContent: string;
  blogTitle: string;
  researchData: any;
  outline?: any[];
  seoAnalysis?: any;
  sectionImages?: Record<string, string>;
  onMetadataGenerated: (metadata: any) => void;
}

interface SEOMetadataResult {
  success: boolean;
  seo_title?: string;
  meta_description?: string;
  url_slug?: string;
  blog_tags?: string[];
  blog_categories?: string[];
  social_hashtags?: string[];
  open_graph?: any;
  twitter_card?: any;
  json_ld_schema?: any;
  canonical_url?: string;
  reading_time?: number;
  focus_keyword?: string;
  generated_at?: string;
  optimization_score?: number;
  error?: string;
}

// Cache helper functions (similar to SEOAnalysisModal)
async function hashContent(text: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback hash
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return String(h);
  }
}

function getMetadataCacheKey(contentHash: string, title?: string): string {
  return `seo_metadata_cache:${contentHash}:${title || ''}`;
}

export const SEOMetadataModal: React.FC<SEOMetadataModalProps> = ({
  isOpen,
  onClose,
  blogContent,
  blogTitle,
  researchData,
  outline,
  seoAnalysis,
  sectionImages,
  onMetadataGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [metadataResult, setMetadataResult] = useState<SEOMetadataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState('preview'); // Start with preview tab first
  const [previewTabValue, setPreviewTabValue] = useState('google'); // Sub-tab for preview platforms
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [editableMetadata, setEditableMetadata] = useState<SEOMetadataResult | null>(null);
  const [contentHash, setContentHash] = useState<string>('');
  const [genProgress, setGenProgress] = useState(0);

  const metadataStageDefinitions = [
    {
      id: 'analyzing',
      label: 'Analyzing',
      icon: '🔍',
      headline: 'Reading your blog to understand the topic',
      description: 'We scan your blog content, outline, and research notes to grasp the central topic, audience, and the keywords that matter most.',
      tip: 'Good SEO starts with knowing what your post is really about — not just the words, but the questions your readers want answered.'
    },
    {
      id: 'title',
      label: 'SEO Title',
      icon: '📝',
      headline: 'Crafting a search-friendly title',
      description: 'We draft an SEO title (50–60 characters) that fits Google’s snippet, includes your focus keyword, and still reads naturally to humans.',
      tip: 'Titles are the #1 thing people see in search results. A clear, keyword-rich title can lift click-through rates by 20–30%.'
    },
    {
      id: 'description',
      label: 'Description',
      icon: '📋',
      headline: 'Writing the meta description and tags',
      description: 'We compose a 150–160 character meta description, pick a URL slug, choose a focus keyword, and generate blog tags and categories that match your topic.',
      tip: 'Meta descriptions don’t directly boost ranking, but they heavily influence whether someone clicks your link over a competitor’s.'
    },
    {
      id: 'social',
      label: 'Social Tags',
      icon: '📱',
      headline: 'Preparing social media cards',
      description: 'We generate Open Graph (Facebook/LinkedIn) and Twitter Card tags so your post looks great when shared — complete with title, description, and a hero image.',
      tip: 'Posts with proper Open Graph tags get 2–3× more engagement on LinkedIn and Facebook compared to plain link shares.'
    },
    {
      id: 'compiling',
      label: 'Compiling',
      icon: '⚡',
      headline: 'Packaging the final metadata package',
      description: 'We assemble JSON-LD structured data (Schema.org Article), finalize the optimization score, and get everything ready to send to WordPress or Wix when you publish.',
      tip: 'Structured data helps search engines understand your article and can enable rich results (like article cards) directly in search.'
    },
  ];

  // Progress simulation while generating (preserves last stage position on error)
  useEffect(() => {
    if (!isGenerating) return;
    setGenProgress(0);
    const interval = setInterval(() => {
      setGenProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 1;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const latestStageIndex = useMemo(() => {
    if (genProgress === 0) return -1;
    const index = Math.floor((genProgress / 100) * metadataStageDefinitions.length);
    return Math.min(index, metadataStageDefinitions.length - 1);
  }, [genProgress]);

  const stagesWithState = useMemo(() => {
    return metadataStageDefinitions.map((stage, i) => {
      let state: 'upcoming' | 'active' | 'done' | 'error' = 'upcoming';
      if (error) {
        state = i === latestStageIndex ? 'error' : i < latestStageIndex ? 'done' : 'upcoming';
      } else if (!isGenerating && metadataResult) {
        state = 'done';
      } else if (latestStageIndex === -1) {
        state = i === 0 ? 'active' : 'upcoming';
      } else if (i < latestStageIndex) {
        state = 'done';
      } else if (i === latestStageIndex) {
        state = 'active';
      }
      return { ...stage, state };
    });
  }, [metadataStageDefinitions, latestStageIndex, isGenerating, genProgress, error, metadataResult]);

  const progressPct = useMemo(() => {
    if (error) return 0;
    if (!isGenerating && metadataResult) return 100;
    const done = stagesWithState.filter(s => s.state === 'done').length;
    const active = stagesWithState.filter(s => s.state === 'active').length;
    if (done === 0 && active === 0) return 0;
    return Math.round(((done + active * 0.5) / metadataStageDefinitions.length) * 100);
  }, [stagesWithState, error, isGenerating, metadataResult]);

  const stageStateStyle: Record<string, { background: string; border: string; color: string }> = {
    upcoming: { background: '#f1f5f9', border: '#e2e8f0', color: '#94a3b8' },
    active: { background: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
    done: { background: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
    error: { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
  };

  // Subscribe to image generation bus to auto-fill OG/Twitter image fields
  useEffect(() => {
    const unsub = subscribeImage(({ base64 }: { base64: string }) => {
      setEditableMetadata(prev => {
        const next = { ...(prev || metadataResult || {}) } as any;
        next.open_graph = { ...(next.open_graph || {}), image: `data:image/png;base64,${base64}` };
        next.twitter_card = { ...(next.twitter_card || {}), image: `data:image/png;base64,${base64}` };
        return next;
      });
    });
    return unsub;
  }, [metadataResult]);

  // Debug logging only in development and when modal state changes meaningfully
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && isOpen) {
      console.log('🔍 SEOMetadataModal render:', {
        isOpen,
        blogContent: blogContent?.length,
        blogTitle,
        researchData: !!researchData
      });
    }
  }, [isOpen, blogContent?.length, blogTitle, researchData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes (but keep result for next time)
      setError(null);
      setIsGenerating(false);
    }
  }, [isOpen]);

  const generateMetadata = useCallback(async (forceRefresh = false) => {
    try {
      setIsGenerating(true);
      setError(null);
      if (forceRefresh) {
        setMetadataResult(null);
      }

      console.log('🚀 Starting SEO metadata generation...', { forceRefresh });

      // Calculate content hash for caching - use existing hash if available
      let hash = contentHash;
      if (!hash) {
        hash = await hashContent(`${blogTitle || ''}\n${blogContent}`);
        // Update state for future use
        setContentHash(hash);
      }
      const cacheKey = getMetadataCacheKey(hash, blogTitle);
      console.log('🔍 Checking SEO metadata cache', { cacheKey, hasHash: !!hash, forceRefresh });

      // Define early so both cache and API paths can use it
      const sanitizeMetadata = (data: any) => {
        const safe = { ...data };
        safe.seo_title = safe.seo_title ?? '';
        safe.meta_description = safe.meta_description ?? '';
        safe.url_slug = safe.url_slug ?? '';
        safe.focus_keyword = safe.focus_keyword ?? '';
        safe.reading_time = typeof safe.reading_time === 'number' ? safe.reading_time : 0;
        safe.blog_tags = Array.isArray(safe.blog_tags) ? safe.blog_tags : [];
        safe.blog_categories = Array.isArray(safe.blog_categories) ? safe.blog_categories : [];
        safe.social_hashtags = Array.isArray(safe.social_hashtags) ? safe.social_hashtags : [];
        safe.open_graph = {
          ...(safe.open_graph || {}),
          title: safe.open_graph?.title ?? '',
          description: safe.open_graph?.description ?? '',
          image: safe.open_graph?.image ?? '',
          url: safe.open_graph?.url ?? ''
        };
        safe.twitter_card = {
          ...(safe.twitter_card || {}),
          title: safe.twitter_card?.title ?? '',
          description: safe.twitter_card?.description ?? '',
          image: safe.twitter_card?.image ?? '',
          site: safe.twitter_card?.site ?? ''
        };
        safe.json_ld_schema = { ...(safe.json_ld_schema || {}) };

        const firstSectionImage = (() => {
          try {
            const images = sectionImages && Object.keys(sectionImages).length > 0
              ? sectionImages
              : JSON.parse(localStorage.getItem('blog_section_images') || '{}');
            const values = Object.values(images).filter(Boolean);
            return values.length > 0 ? String(values[0]) : null;
          } catch { return null; }
        })();
        if (firstSectionImage) {
          const isPlaceholder = (url: string) => !url || url === 'https://example.com/image.jpg' || url.includes('example.com') || url.includes('placeholder');
          if (isPlaceholder(safe.open_graph?.image || '')) {
            safe.open_graph = { ...safe.open_graph, image: firstSectionImage };
          }
          if (isPlaceholder(safe.twitter_card?.image || '')) {
            safe.twitter_card = { ...safe.twitter_card, image: firstSectionImage };
          }
        }

        return safe;
      };

      // Check cache first (unless force refresh)
      if (!forceRefresh && typeof window !== 'undefined') {
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as SEOMetadataResult;
            // Validate cached data has required fields
            if (parsed && parsed.success !== undefined) {
              console.log('✅ Using cached SEO metadata', { cacheKey, success: parsed.success });
              const sanitized = sanitizeMetadata(parsed);
              setMetadataResult(sanitized);
              setEditableMetadata(sanitized);
              setIsGenerating(false);
              // Notify parent that metadata is available
              if (onMetadataGenerated) {
                onMetadataGenerated(sanitized);
              }
              return;
            } else {
              console.warn('⚠️ Cached SEO metadata data is invalid, will fetch fresh metadata');
            }
          } catch (e) {
            console.warn('⚠️ Failed to parse cached SEO metadata, will fetch fresh metadata', e);
            // Remove invalid cache entry
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem(cacheKey);
            }
          }
        } else {
          console.log('ℹ️ No cached SEO metadata found, will fetch from API', { cacheKey });
        }
      } else {
        console.log('🔄 Force refresh requested, skipping cache check');
      }

      // Make API call to generate metadata
      const response = await aiApiClient.post('/api/blog/seo/metadata', {
        content: blogContent,
        title: blogTitle,
        research_data: researchData,
        outline: outline || null,
        seo_analysis: seoAnalysis || null
      });

      const result = response.data;
      console.log('✅ SEO metadata generation response:', result);

      // Check if the response indicates a subscription/usage error (even if HTTP status is 200)
      if (!result.success && result.error) {
        const errorMessage = (result.error || '').toLowerCase();
        // Check if error message indicates subscription/balance limit
        if (errorMessage.includes('token limit') || 
            errorMessage.includes('balance') ||
            errorMessage.includes('insufficient') ||
            errorMessage.includes('limit would be exceeded') ||
            errorMessage.includes('usage limit') ||
            errorMessage.includes('subscription') ||
            errorMessage.includes('403') ||
            errorMessage.includes('429') ||
            errorMessage.includes('quota')) {
          console.log('SEOMetadataModal: Detected subscription error in response data', {
            error: errorMessage,
            data: result
          });
          
          // Create a mock error object with subscription error data
          const mockError = {
            response: {
              status: 429, // Treat as 429 for subscription error
              data: {
                error: errorMessage,
                message: result.message || errorMessage,
                provider: result.provider || 'unknown',
                usage_info: result.usage_info || {}
              }
            }
          };
          
          const handled = await triggerSubscriptionError(mockError);
          if (handled) {
            console.log('SEOMetadataModal: Global subscription error handler triggered successfully');
            setIsGenerating(false);
            return;
          } else {
            console.warn('SEOMetadataModal: Global subscription error handler did not handle the error');
          }
        }
        
        // If not a subscription error, throw the error normally
        throw new Error(result.error || 'Metadata generation failed');
      }

      // Cache the result
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(result));
          console.log('💾 SEO metadata cached');
        } catch (e) {
          console.warn('Failed to cache metadata:', e);
        }
      }

      const sanitized = sanitizeMetadata(result);
      setMetadataResult(sanitized);
      setEditableMetadata(sanitized);
      // Notify parent so SEO metadata is in app state (e.g. for pre-publish check,
      // SEO analysis flow, and persistence). Without this, only the cache-hit
      // path or an explicit "Apply Metadata" click would push it to the parent.
      if (onMetadataGenerated) {
        onMetadataGenerated(sanitized);
      }
      console.log('📊 Metadata result set:', result);

    } catch (err: any) {
      console.error('❌ SEO metadata generation failed:', err);
      
      // Check if this is a subscription error (429/402/403) or balance/limit issue
      const status = err?.response?.status;
      const rawError = err?.response?.data?.error || err?.response?.data?.message || '';
      const errorMessage = err?.message || rawError || '';
      const fullMessage = (errorMessage + ' ' + rawError + ' ' + JSON.stringify(err?.response?.data || {})).toLowerCase();
      
      // Check HTTP status code for subscription/balance errors
      if (status === 429 || status === 402 || status === 403) {
        console.log('SEOMetadataModal: Detected usage/subscription error (HTTP status)', {
          status,
          data: err?.response?.data
        });
        const handled = await triggerSubscriptionError(err);
        if (handled) {
          console.log('SEOMetadataModal: Global subscription error handler triggered successfully');
          setIsGenerating(false);
          return;
        } else {
          console.warn('SEOMetadataModal: Global subscription error handler did not handle the error');
        }
      }
      
      // Check error message for balance/usage/subscription-related errors
      if (fullMessage.includes('balance') ||
          fullMessage.includes('insufficient') ||
          fullMessage.includes('limit would be exceeded') ||
          fullMessage.includes('usage limit') ||
          fullMessage.includes('token limit') ||
          fullMessage.includes('subscription') ||
          fullMessage.includes('429') ||
          fullMessage.includes('403') ||
          fullMessage.includes('quota')) {
        console.log('SEOMetadataModal: Detected usage/subscription error (message match)', {
          fullMessage,
          err
        });
        
        const mockError = {
          response: {
            status: 429,
            data: {
              error: errorMessage,
              message: errorMessage,
              provider: err?.response?.data?.provider || 'unknown',
              usage_info: err?.response?.data?.usage_info || {}
            }
          }
        };
        
        const handled = await triggerSubscriptionError(mockError);
        if (handled) {
          console.log('SEOMetadataModal: Global subscription error handler triggered successfully (from message)');
          setIsGenerating(false);
          return;
        } else {
          console.warn('SEOMetadataModal: Global subscription error handler did not handle the error');
        }
      }
      
      // For non-subscription errors, show local error message
      setError(err instanceof Error ? err.message : 'Failed to generate SEO metadata');
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  }, [blogContent, blogTitle, researchData, outline, seoAnalysis, contentHash, onMetadataGenerated]);

  // Precompute hash when modal opens and trigger cache check
  useEffect(() => {
    if (isOpen && !contentHash) {
      (async () => {
        const h = await hashContent(`${blogTitle || ''}\n${blogContent}`);
        setContentHash(h);
        // After hash is computed, check cache if we don't have metadata result yet
        if (!metadataResult) {
          // Small delay to ensure hash is set in state
          setTimeout(() => {
            generateMetadata(false);
          }, 100);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, blogContent, blogTitle]);

  // Fallback: if modal opens and hash is already computed, check cache immediately
  useEffect(() => {
    if (isOpen && !metadataResult && contentHash) {
      generateMetadata(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contentHash]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const handleCopyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set([...prev, itemId]));
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleMetadataEdit = (field: string, value: any) => {
    if (editableMetadata) {
      setEditableMetadata(prev => ({
        ...prev!,
        [field]: value
      }));
    }
  };

  /**
   * Handle Apply Metadata button click
   * 
   * This saves the generated/edited metadata to the parent component's state.
   * The metadata is then used when publishing to platforms:
   * - WordPress: Requires SEO metadata for proper post creation with SEO fields
   * - Wix: Currently doesn't require metadata, but could be added in future
   * 
   * The metadata includes:
   * - SEO title, meta description, URL slug
   * - Blog tags, categories, focus keyword
   * - Open Graph tags (Facebook/LinkedIn)
   * - Twitter Card tags
   * - JSON-LD structured data (Schema.org Article)
   * 
   * All of these will be passed to the platform's API when publishing.
   */
  const handleApplyMetadata = () => {
    if (editableMetadata) {
      onMetadataGenerated(editableMetadata);
      onClose();
    }
  };

  const getTabIcon = (tabValue: string) => {
    switch (tabValue) {
      case 'core': return <SearchIcon />;
      case 'social': return <ShareIcon />;
      case 'structured': return <CodeIcon />;
      case 'preview': return <PreviewIcon />;
      default: return <TagIcon />;
    }
  };

  const getTabLabel = (tabValue: string) => {
    switch (tabValue) {
      case 'core': return 'Core SEO';
      case 'social': return 'Social Media';
      case 'structured': return 'Structured Data';
      case 'preview': return 'Preview';
      default: return 'Metadata';
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          minHeight: '80vh'
        }
      }}
    >
      <style>{`
        @keyframes seoMetaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.15); }
          50% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
        }
      `}</style>
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
        borderBottom: '1px solid rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TagIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
            SEO Metadata Generator
          </Typography>
          {metadataResult && (
            <Chip 
              label={`${metadataResult.optimization_score || 0}% Optimized`}
              color={metadataResult.optimization_score && metadataResult.optimization_score >= 80 ? 'success' : 
                     metadataResult.optimization_score && metadataResult.optimization_score >= 60 ? 'warning' : 'error'}
              size="small"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {metadataResult && (
            <Tooltip title="Regenerate SEO metadata">
              <IconButton 
                onClick={() => generateMetadata(true)} 
                size="small"
                disabled={isGenerating}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {isGenerating && (() => {
          const activeStage = metadataStageDefinitions[Math.max(0, latestStageIndex)];
          const activeStageState = stagesWithState[Math.max(0, latestStageIndex)];
          return (
            <Box sx={{ p: 4 }}>
              {/* What is SEO Metadata? intro card */}
              <Box sx={{ mb: 3, p: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bfdbfe' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e3a8a', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontSize: 18 }}>💡</span> What is SEO Metadata?
                </Typography>
                <Typography variant="body2" sx={{ color: '#1e40af', lineHeight: 1.55 }}>
                  SEO metadata is the behind-the-scenes information that tells search engines (like Google) and social media sites what your blog is about. A great post with weak metadata is like a beautiful book with no title on the cover — people scroll right past it. We’re creating the title, description, tags, and share cards so your blog actually gets discovered and clicked.
                </Typography>
              </Box>

              {/* Progress bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                  <Box sx={{ width: `${progressPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #3b82f6, #2563eb)', transition: 'width 0.5s ease' }} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                  {stagesWithState.filter(s => s.state === 'done').length}/{metadataStageDefinitions.length} steps
                </Typography>
              </Box>

              {/* Active stage detail card */}
              {activeStage && activeStageState && (
                <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, background: '#ffffff', border: '1px solid #e0e7ff', borderLeft: '4px solid #2563eb' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Box sx={{ fontSize: 20, lineHeight: 1 }}>{activeStage.icon}</Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', flex: 1 }}>
                      {activeStage.headline}
                    </Typography>
                    {activeStageState.state === 'active' && <CircularProgress size={14} thickness={5} sx={{ color: '#2563eb' }} />}
                    {activeStageState.state === 'done' && <Typography sx={{ fontSize: 14, color: '#047857', fontWeight: 700 }}>✓</Typography>}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55, mb: 1.25 }}>
                    {activeStage.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', p: 1.25, borderRadius: 1.5, background: '#fef3c7', border: '1px solid #fde68a' }}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: '#78350f', flex: 1 }}>
                      <strong>Did you know?</strong> {activeStage.tip}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Stage chips (compact stepper) */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {stagesWithState.map(stage => {
                  const copy = stageStateStyle[stage.state];
                  return (
                    <Box key={stage.id} sx={{ flex: 1, py: 1, px: 0.5, borderRadius: 1.5, backgroundColor: copy.background, border: `1px solid ${copy.border}`, textAlign: 'center', animation: stage.state === 'active' ? 'seoMetaPulse 2s ease-in-out infinite' : undefined, transition: 'all 0.3s ease' }}>
                      <Box sx={{ fontSize: 18, lineHeight: 1, mb: 0.25 }}>
                        {stage.state === 'active' ? <CircularProgress size={16} thickness={5} sx={{ color: '#1d4ed8' }} /> : stage.icon}
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: copy.color, display: 'block', fontSize: '0.6rem', lineHeight: 1.2 }}>
                        {stage.state === 'active' ? 'Working…' : stage.state === 'done' ? 'Done' : stage.state === 'error' ? 'Error' : stage.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* What happens next preview */}
              <Box sx={{ mt: 3, p: 2, borderRadius: 2, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', display: 'block', mb: 1 }}>
                  What happens next
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>📝</span> Review and edit any of the generated fields in the tabs
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>✅</span> Click <strong style={{ marginLeft: 2, marginRight: 2 }}>Apply Metadata</strong> to lock it in
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>🚀</span> Your metadata will travel with the post to WordPress or Wix
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })()}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Button
              variant="outlined"
              onClick={() => generateMetadata(true)}
              startIcon={<RefreshIcon />}
            >
              Try Again
            </Button>
          </Box>
        )}

        {metadataResult && (
          <Box>
            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 48 }}
              >
                {['preview', 'core', 'social', 'structured'].map((tab) => (
                  <Tab
                    key={tab}
                    value={tab}
                    label={getTabLabel(tab)}
                    icon={getTabIcon(tab)}
                    iconPosition="start"
                    sx={{ minHeight: 48, textTransform: 'none' }}
                  />
                ))}
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ p: 3 }}>
              {tabValue === 'core' && (
                <CoreMetadataTab
                  metadata={editableMetadata || metadataResult}
                  onMetadataEdit={handleMetadataEdit}
                  onCopyToClipboard={handleCopyToClipboard}
                  copiedItems={copiedItems}
                />
              )}

              {tabValue === 'social' && (
                <SocialMediaTab
                  metadata={editableMetadata || metadataResult}
                  onMetadataEdit={handleMetadataEdit}
                  onCopyToClipboard={handleCopyToClipboard}
                  copiedItems={copiedItems}
                />
              )}

              {tabValue === 'structured' && (
                <StructuredDataTab
                  metadata={editableMetadata || metadataResult}
                  onMetadataEdit={handleMetadataEdit}
                  onCopyToClipboard={handleCopyToClipboard}
                  copiedItems={copiedItems}
                />
              )}

              {tabValue === 'preview' && (
                <PreviewCard
                  metadata={editableMetadata || metadataResult}
                  blogTitle={blogTitle}
                  previewTabValue={previewTabValue}
                  onPreviewTabChange={setPreviewTabValue}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {metadataResult && (
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Button
            variant="outlined"
            onClick={() => generateMetadata(true)}
            startIcon={<RefreshIcon />}
            sx={{ mr: 'auto' }}
          >
            Regenerate
          </Button>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApplyMetadata}
            startIcon={<CheckIcon />}
            sx={{ px: 3 }}
          >
            Apply Metadata
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
