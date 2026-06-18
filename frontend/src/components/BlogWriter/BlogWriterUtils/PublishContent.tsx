import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { wordpressAPI, WordPressSite, WordPressPublishRequest } from '../../../api/wordpress';
import { blogWriterApi, BlogSEOMetadataResponse } from '../../../services/blogWriterApi';
import hallucinationDetectorService from '../../../services/hallucinationDetectorService';
import WixConnectModal from './WixConnectModal';
import { useWixPublish } from '../../../hooks/useWixPublish';
import { useTextToSpeech } from '../../../hooks/useTextToSpeech';
import PublishProgressModal from '../PublishProgressModal';

const saveCompleteBlogAsset = async (
  title: string,
  content: string,
  seoMetadata: BlogSEOMetadataResponse | null,
  platform?: string,
  post_url?: string,
  post_id?: string,
) => {
  try {
    await apiClient.post('/api/blog/save-complete-asset', {
      title,
      content,
      platform: platform || null,
      post_url: post_url || null,
      post_id: post_id || null,
      seo_title: seoMetadata?.seo_title,
      meta_description: seoMetadata?.meta_description,
      focus_keyword: seoMetadata?.focus_keyword,
      tags: seoMetadata?.blog_tags || [],
      categories: seoMetadata?.blog_categories || [],
    });
  } catch (error) {
    console.error('Failed to save complete blog asset:', error);
  }
};

interface PublishContentProps {
  buildFullMarkdown: () => string;
  convertMarkdownToHTML: (md: string) => string;
  seoMetadata: BlogSEOMetadataResponse | null;
  seoAnalysis?: any;
  blogTitle?: string;
  sectionImages?: Record<string, string>;
  onOpenSEOMetadata?: () => void;
  flowAnalysisResults?: any;
  onRunFlowAnalysis?: () => void;
}

export const PublishContent: React.FC<PublishContentProps> = ({
  buildFullMarkdown,
  convertMarkdownToHTML,
  seoMetadata,
  seoAnalysis,
  blogTitle,
  sectionImages,
  onOpenSEOMetadata,
  flowAnalysisResults,
  onRunFlowAnalysis,
}) => {
  const {
    wixStatus,
    checkingWix,
    publishingWix,
    publishToWix,
    showWixConnectModal,
    setShowWixConnectModal,
    closeWixConnectModal,
    handleWixConnectionSuccess,
    validateWixContent,
  } = useWixPublish();

  const [wordpressSites, setWordpressSites] = useState<WordPressSite[]>([]);
  const [checkingWP, setCheckingWP] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ platform: string; success: boolean; message: string; url?: string } | null>(null);
  const [publishProgress, setPublishProgress] = useState<{ platform: string; currentStage: number; done: boolean; error: string | null } | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [wixContentWarning, setWixContentWarning] = useState<string | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [hallucinationResults, setHallucinationResults] = useState<any>(null);
  const [hallucinationRunning, setHallucinationRunning] = useState(false);
  const [publishHistory, setPublishHistory] = useState<{ entries: any[]; total: number } | null>(null);
  const [showPublishHistory, setShowPublishHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (flowRunning && flowAnalysisResults) setFlowRunning(false);
  }, [flowAnalysisResults, flowRunning]);

  // Audio / TTS
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech();
  const [isListening, setIsListening] = useState(false);

  const stripMarkdown = (md: string) => {
    return md
      .replace(/[#*_~`]/g, '')
      .replace(/\[(.*?)\]\(.*\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  const handleListen = () => {
    if (isSpeaking) {
      stop();
      setIsListening(false);
      return;
    }
    const md = buildFullMarkdown();
    const plainText = stripMarkdown(md);
    if (!plainText) return;
    setIsListening(true);
    speak(plainText, { rate: 1 });
  };

  useEffect(() => {
    if (isListening && !isSpeaking) {
      setIsListening(false);
    }
  }, [isSpeaking, isListening]);

  useEffect(() => {
    checkWPStatus();
  }, []);

  const checkWPStatus = async () => {
    setCheckingWP(true);
    try {
      const status = await wordpressAPI.getStatus();
      setWordpressSites(status.sites || []);
    } catch {
      setWordpressSites([]);
    } finally {
      setCheckingWP(false);
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const finishPublishProgress = (success: boolean, platform: string, message: string, url?: string) => {
    setPublishResult({ platform, success, message, url });
    if (success) {
      setPublishProgress(prev => prev ? { ...prev, currentStage: 3, done: true } : null);
      setTimeout(() => setPublishProgress(null), 2000);
    } else {
      setPublishProgress(prev => prev ? { ...prev, error: message } : null);
    }
    setPublishing(null);
  };

  const publishToWordPress = async () => {
    const md = buildFullMarkdown();
    const html = convertMarkdownToHTML(md);
    setPublishing('wordpress');
    setPublishResult(null);
    setPublishProgress({ platform: 'wordpress', currentStage: 0, done: false, error: null });
    await delay(400);

    try {
      // Stage 0: Validating
      if (!seoMetadata) {
        finishPublishProgress(false, 'wordpress', 'Generate SEO metadata first before publishing.');
        return;
      }

      // Stage 1: Connecting
      setPublishProgress(prev => prev ? { ...prev, currentStage: 1 } : null);
      await delay(400);

      const activeSite = wordpressSites.find(s => s.is_active) || wordpressSites[0];
      if (!activeSite) {
        finishPublishProgress(false, 'wordpress', 'No WordPress sites connected. Go to Settings > Integrations to add one.');
        return;
      }

      // Stage 2: Publishing
      setPublishProgress(prev => prev ? { ...prev, currentStage: 2 } : null);
      await delay(400);

      const title = seoMetadata.seo_title || md.match(/^#\s+(.+)$/m)?.[1] || 'Blog Post';
      const request: WordPressPublishRequest = {
        site_id: activeSite.id,
        title,
        content: html,
        excerpt: seoMetadata.meta_description || '',
        status: 'publish',
        meta_description: seoMetadata.meta_description || '',
        tags: seoMetadata.blog_tags || [],
        categories: seoMetadata.blog_categories || [],
      };

      const result = await wordpressAPI.publishContent(request);
      if (result.success) {
        finishPublishProgress(true, 'wordpress', `Published to "${activeSite.site_name}"!`, result.post_url);
        saveCompleteBlogAsset(blogTitle || seoMetadata?.seo_title || 'Blog Post', md, seoMetadata, 'wordpress', result.post_url, String(result.post_id ?? ''));
        try { localStorage.setItem('blog_publish_completed', 'true'); } catch {}
      } else {
        finishPublishProgress(false, 'wordpress', result.error || 'Publish failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'Publish failed';
      finishPublishProgress(false, 'wordpress', msg);
    }
  };

  // Inject section images from state (or localStorage fallback) into markdown
  const enrichMarkdownWithImages = (markdown: string): string => {
    try {
      const images = sectionImages && Object.keys(sectionImages).length > 0
        ? sectionImages
        : JSON.parse(localStorage.getItem('blog_section_images') || '{}');
      const outline = JSON.parse(localStorage.getItem('blog_outline') || '[]');
      if (!outline.length || !Object.keys(images).length) return markdown;

      let enriched = markdown;
      for (const section of outline) {
        const image = images[section.id];
        if (!image) continue;
        // Only inject URL-based images (http or /api/); skip base64 (too large for Wix API)
        if (!image.startsWith('http') && !image.startsWith('/api/')) continue;

        const heading = section.heading;
        const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(##\\s+${escapedHeading}\\n\\n)`);
        enriched = enriched.replace(pattern, `$1![${heading}](${image})\n\n`);
      }
      return enriched;
    } catch {
      return markdown;
    }
  };

  const handlePublishToWix = async () => {
    const md = buildFullMarkdown();
    const enrichedMd = enrichMarkdownWithImages(md);
    setPublishResult(null);
    setWixContentWarning(null);
    setPublishProgress({ platform: 'wix', currentStage: 0, done: false, error: null });
    await delay(400);

    // Stage 0: Validating
    const validation = validateWixContent(enrichedMd);
    if (!validation.valid) {
      setPublishProgress(prev => prev ? { ...prev, error: validation.warning || 'Content validation failed.' } : null);
      setPublishResult({ platform: 'wix', success: false, message: validation.warning || 'Content validation failed.' });
      return;
    }
    if (validation.warning) {
      setWixContentWarning(validation.warning);
    }

    // Stage 1: Connecting
    setPublishProgress(prev => prev ? { ...prev, currentStage: 1 } : null);
    await delay(400);

    // Stage 2: Publishing
    setPublishProgress(prev => prev ? { ...prev, currentStage: 2 } : null);
    await delay(400);

    const result = await publishToWix(enrichedMd, seoMetadata, blogTitle);
    if (result.success) {
      setPublishProgress(prev => prev ? { ...prev, currentStage: 3, done: true } : null);
      setTimeout(() => setPublishProgress(null), 2000);
      saveCompleteBlogAsset(blogTitle || seoMetadata?.seo_title || 'Blog Post', md, seoMetadata, 'wix', result.url, result.post_id);
      try { localStorage.setItem('blog_publish_completed', 'true'); } catch {}
    } else {
      setPublishProgress(prev => prev ? { ...prev, error: result.message } : null);
    }
    setPublishResult({ platform: 'wix', success: result.success, message: result.message, url: result.url });
    if (result.warning && result.success) {
      setWixContentWarning(result.warning);
    }
  };

  const handleWixClick = () => {
    if (wixStatus?.connected) {
      handlePublishToWix();
    } else {
      setShowWixConnectModal(true);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(buildFullMarkdown());
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const handleCopyHTML = () => {
    navigator.clipboard.writeText(convertMarkdownToHTML(buildFullMarkdown()));
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    padding: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s',
  };

  const handleOpenPublishHistory = async () => {
    setShowPublishHistory(true);
    if (!publishHistory) {
      setHistoryLoading(true);
      try {
        const { data } = await apiClient.get('/api/blog/publish-history?limit=50');
        if (data.success) {
          setPublishHistory({ entries: data.entries, total: data.total });
        }
      } catch (err) {
        console.error('Failed to load publish history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const handleRunHallucinationCheck = async () => {
    setHallucinationRunning(true);
    try {
      const text = buildFullMarkdown();
      const result = await hallucinationDetectorService.detectHallucinations({ text });
      setHallucinationResults(result);
    } catch (err) {
      console.error('Hallucination check failed:', err);
      setHallucinationResults({ success: false, error: 'Check failed' });
    } finally {
      setHallucinationRunning(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Publish Your Blog</h2>
      <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.9rem' }}>
        Your blog is ready to publish. Choose a platform below.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* SEO Metadata card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>SEO Metadata</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {seoMetadata ? 'Generated' : 'Not generated'}
              </p>
            </div>
            <button
              onClick={onOpenSEOMetadata}
              style={{
                ...btnStyle,
                background: seoMetadata ? '#f1f5f9' : 'linear-gradient(135deg, #059669, #047857)',
                color: seoMetadata ? '#334155' : '#fff',
                border: seoMetadata ? '1px solid #e2e8f0' : 'none',
                cursor: 'pointer',
              }}
            >
              {seoMetadata ? 'View SEO Metadata' : 'Generate SEO Metadata'}
            </button>
          </div>
          {seoMetadata && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#334155' }}>
              <div style={{ fontWeight: 600 }}>{seoMetadata.seo_title}</div>
              <div style={{ color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{seoMetadata.meta_description}</div>
              {seoMetadata.focus_keyword && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500 }}>
                    {seoMetadata.focus_keyword}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pre-Publish Readiness Check */}
        <div style={cardStyle}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Pre-Publish Readiness Check</h3>
          <p style={{ margin: '4px 0 12px 0', fontSize: '0.85rem', color: '#64748b' }}>
            Verify your content is ready before publishing
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* SEO Metadata check */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: seoMetadata ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${seoMetadata ? '#86efac' : '#fecaca'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{seoMetadata ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#0f172a' }}>SEO Metadata</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {seoMetadata ? `Generated (Score: ${seoAnalysis?.overall_score ?? 'N/A'}/100)` : 'Not generated'}
                  </div>
                </div>
              </div>
              {seoMetadata && (
                <button onClick={onOpenSEOMetadata} style={{ ...btnStyle, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  View
                </button>
              )}
            </div>

            {/* Flow Analysis check */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: flowAnalysisResults ? '#f0fdf4' : '#fafafa', borderRadius: 8, border: `1px solid ${flowAnalysisResults ? '#86efac' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{flowAnalysisResults ? '✅' : '🔲'}</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#0f172a' }}>Flow Analysis</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {flowAnalysisResults
                      ? `Flow: ${(flowAnalysisResults.overall_flow_score * 100).toFixed(0)} | Consistency: ${(flowAnalysisResults.overall_consistency_score * 100).toFixed(0)} | Progression: ${(flowAnalysisResults.overall_progression_score * 100).toFixed(0)}`
                      : 'Not yet run'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onRunFlowAnalysis) {
                    setFlowRunning(true);
                    onRunFlowAnalysis();
                    // Reset loading after a reasonable timeout
                    setTimeout(() => setFlowRunning(false), 30000);
                  }
                }}
                disabled={flowRunning || !onRunFlowAnalysis}
                style={{ ...btnStyle, background: flowRunning ? '#e2e8f0' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: flowRunning ? '#94a3b8' : '#fff', padding: '4px 12px', fontSize: '0.8rem', cursor: flowRunning ? 'not-allowed' : 'pointer' }}
              >
                {flowRunning ? 'Analyzing...' : flowAnalysisResults ? 'Re-analyze' : 'Run Analysis'}
              </button>
            </div>

            {/* Hallucination Check */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: hallucinationResults?.success ? '#f0fdf4' : hallucinationResults && !hallucinationResults.success ? '#fef2f2' : '#fafafa', borderRadius: 8, border: `1px solid ${hallucinationResults?.success ? '#86efac' : hallucinationResults && !hallucinationResults.success ? '#fecaca' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{hallucinationResults?.success ? '✅' : hallucinationResults && !hallucinationResults.success ? '❌' : '🔲'}</span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#0f172a' }}>Hallucination Check</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {hallucinationResults?.success
                      ? `${hallucinationResults.supported_claims ?? 0} supported, ${hallucinationResults.refuted_claims ?? 0} refuted, ${hallucinationResults.insufficient_claims ?? 0} unclear (${(hallucinationResults.overall_confidence * 100).toFixed(0)}% confidence)`
                      : hallucinationResults?.error
                        ? hallucinationResults.error
                        : 'Not yet run'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleRunHallucinationCheck}
                disabled={hallucinationRunning}
                style={{ ...btnStyle, background: hallucinationRunning ? '#e2e8f0' : 'linear-gradient(135deg, #dc2626, #b91c1c)', color: hallucinationRunning ? '#94a3b8' : '#fff', padding: '4px 12px', fontSize: '0.8rem', cursor: hallucinationRunning ? 'not-allowed' : 'pointer' }}
              >
                {hallucinationRunning ? 'Checking...' : hallucinationResults ? 'Re-check' : 'Run Check'}
              </button>
            </div>
          </div>

          {/* Overall status */}
          <div style={{ marginTop: 8, fontSize: '0.8rem', fontWeight: 500, color: (seoMetadata && flowAnalysisResults && hallucinationResults?.success) ? '#166534' : '#92400e' }}>
            {(seoMetadata && flowAnalysisResults && hallucinationResults?.success)
              ? '✅ All checks passed — ready to publish!'
              : seoMetadata && flowAnalysisResults
                ? '⚠️ Run hallucination check before publishing for best results'
                : seoMetadata
                  ? '⚠️ Run flow analysis and hallucination check before publishing'
                  : '⚠️ Generate SEO metadata and run quality checks before publishing'}
          </div>
        </div>

        {/* WordPress card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>WordPress</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {checkingWP ? 'Checking connection...' : wordpressSites.length > 0 ? `${wordpressSites.length} site(s) connected` : 'No sites connected'}
              </p>
            </div>
            <button
              onClick={publishToWordPress}
              disabled={publishing === 'wordpress' || wordpressSites.length === 0}
              style={{
                ...btnStyle,
                background: wordpressSites.length > 0 ? 'linear-gradient(135deg, #21759b, #1a6a8a)' : '#e2e8f0',
                color: wordpressSites.length > 0 ? '#fff' : '#94a3b8',
                cursor: wordpressSites.length > 0 && publishing !== 'wordpress' ? 'pointer' : 'not-allowed',
              }}
            >
              {publishing === 'wordpress' ? 'Publishing...' : 'Publish to WordPress'}
            </button>
          </div>
          {wordpressSites.length > 0 && wordpressSites[0] && (
            <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>
              Target: {wordpressSites[0].site_name} ({wordpressSites[0].site_url})
            </div>
          )}
        </div>

        {/* Wix card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Wix</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                {checkingWix ? 'Checking connection...' : wixStatus?.connected ? 'Connected' : wixStatus?.error || 'Not connected'}
              </p>
            </div>
            <button
              onClick={handleWixClick}
              disabled={publishingWix}
              style={{
                ...btnStyle,
                background: wixStatus?.connected ? 'linear-gradient(135deg, #0a6eff, #0052cc)' : '#6366f1',
                color: '#fff',
                cursor: !publishingWix ? 'pointer' : 'not-allowed',
              }}
            >
              {publishingWix ? 'Publishing...' : wixStatus?.connected ? 'Publish to Wix' : 'Connect Wix'}
            </button>
          </div>
          {wixStatus?.connected && wixStatus.site_info && (
            <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>
              Site: {wixStatus.site_info.name || wixStatus.site_info.displayName}
            </div>
          )}
          {wixContentWarning && (
            <div style={{ marginTop: 8, padding: '6px 10px', fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d' }}>
              {wixContentWarning}
            </div>
          )}
        </div>

        {/* Export card */}
        <div style={cardStyle}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Export</h3>
          <p style={{ margin: '4px 0 12px 0', fontSize: '0.85rem', color: '#64748b' }}>
            Copy your blog content for use elsewhere
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleCopyMarkdown}
              style={{ ...btnStyle, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}
            >
              {copyDone ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              onClick={handleCopyHTML}
              style={{ ...btnStyle, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}
            >
              {copyDone ? 'Copied!' : 'Copy HTML'}
            </button>
            {isSupported && (
              <button
                onClick={handleListen}
                style={{
                  ...btnStyle,
                  background: isListening ? '#fef2f2' : '#f1f5f9',
                  color: isListening ? '#991b1b' : '#334155',
                  border: `1px solid ${isListening ? '#fecaca' : '#e2e8f0'}`,
                }}
              >
                {isListening ? '🔊 Stop Listening' : '🔈 Listen to Blog'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Publish result */}
      {publishResult && (
        <div style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          background: publishResult.success ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${publishResult.success ? '#86efac' : '#fecaca'}`,
          color: publishResult.success ? '#166534' : '#991b1b',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {publishResult.success ? '✅ Published!' : '❌ Publish failed'}
          </div>
          <div style={{ fontSize: '0.9rem' }}>{publishResult.message}</div>
          {publishResult.url && (
            <a href={publishResult.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', marginTop: 4, display: 'inline-block' }}>
              View published post
            </a>
          )}

          {/* Post-publish actions (disabled placeholders for future features) */}
          {publishResult.success && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                More Actions
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  disabled
                  title="Coming soon — update the published post with latest edits"
                  style={{
                    ...btnStyle, background: '#e2e8f0', color: '#94a3b8',
                    cursor: 'not-allowed', fontSize: '0.8rem',
                  }}
                >
                  Update Published Post
                </button>
                <button
                  disabled
                  title="Coming soon — schedule publish for a future date/time"
                  style={{
                    ...btnStyle, background: '#e2e8f0', color: '#94a3b8',
                    cursor: 'not-allowed', fontSize: '0.8rem',
                  }}
                >
                  Schedule Publish
                </button>
                <button
                  onClick={handleOpenPublishHistory}
                  style={{
                    ...btnStyle, background: '#f1f5f9', color: '#334155',
                    border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.8rem',
                  }}
                >
                  Publish History
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <WixConnectModal
        isOpen={showWixConnectModal}
        onClose={closeWixConnectModal}
        onConnectionSuccess={handleWixConnectionSuccess}
      />

      <PublishProgressModal
        open={publishProgress !== null}
        platform={publishProgress?.platform || ''}
        currentStage={publishProgress?.currentStage ?? 0}
        done={publishProgress?.done ?? false}
        error={publishProgress?.error}
        onClose={() => setPublishProgress(null)}
      />

      {/* Publish History modal */}
      {showPublishHistory && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowPublishHistory(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Publish History</h3>
              <button onClick={() => setShowPublishHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}>✕</button>
            </div>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Loading history...</div>
            ) : publishHistory && publishHistory.entries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {publishHistory.entries.map((entry: any) => (
                  <div key={entry.asset_id} style={{
                    padding: 12, borderRadius: 8, border: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#0f172a' }}>{entry.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                        {entry.platform === 'wix' ? 'Wix' : entry.platform === 'wordpress' ? 'WordPress' : entry.platform}
                        {entry.published_at && ` · ${new Date(entry.published_at).toLocaleDateString()}`}
                        {entry.word_count > 0 && ` · ${entry.word_count} words`}
                      </div>
                    </div>
                    {entry.post_url && (
                      <a href={entry.post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'none' }}>
                        View →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                No publish history yet. Publish your blog to see it here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishContent;
