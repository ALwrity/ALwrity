import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { CloudDone as CloudDoneIcon, HourglassEmpty as HourglassEmptyIcon } from '@mui/icons-material';
import { apiClient, longRunningApiClient } from '../../../api/client';

const PHASE_MAP: Record<string, string> = {
  'harvesting': 'Harvesting website pages...',
  'indexing_metadata': 'Indexing site metadata...',
  'indexing_content': 'Indexing page content...',
  'analyzing': 'Analyzing content pillars...',
  'complete': 'Indexing complete',
};

const PHASE_COLORS: Record<string, string> = {
  'harvesting': '#2563eb',
  'indexing_metadata': '#7c3aed',
  'indexing_content': '#7c3aed',
  'analyzing': '#f59e0b',
  'complete': '#16a34a',
};

interface IndexedPage {
  url: string;
  title: string;
}

export const SifIndexingPanel: React.FC = () => {
  const [sifStatus, setSifStatus] = useState<'idle' | 'indexing' | 'partial' | 'done' | 'error'>('idle');
  const [sifPhase, setSifPhase] = useState('');
  const [sifPageCount, setSifPageCount] = useState<number | null>(null);
  const [sifPageTotal, setSifPageTotal] = useState<number | null>(null);
  const [sifPillarCount, setSifPillarCount] = useState<number | null>(null);
  const [sifLastIndexed, setSifLastIndexed] = useState<string | null>(null);
  const [sifErrorReason, setSifErrorReason] = useState<string | null>(null);
  const [sifRetriggering, setSifRetriggering] = useState(false);
  const [indexedPages, setIndexedPages] = useState<IndexedPage[]>([]);
  const [showPagesModal, setShowPagesModal] = useState(false);
  const [harvestSource, setHarvestSource] = useState<string>('');
  const [freshnessHours, setFreshnessHours] = useState<number | null>(null);
  const [sitemapTotal, setSitemapTotal] = useState<number | null>(null);
  const [testQuery, setTestQuery] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string>('');

  const handleTestQuery = async (query: string) => {
    setTestQuery(query);
    setTestResult('');
    try {
      const res = await apiClient.get('/api/onboarding/sif/search', { params: { q: query, limit: 3 } });
      const hits = res?.data?.hits || [];
      setTestResult(hits.length > 0
        ? hits.map((h: any) => h?.text?.slice(0, 200) || h?.title || '').join('\n---\n')
        : 'No results found — content may not be indexed yet.');
    } catch {
      setTestResult('Search unavailable — try re-indexing.');
    }
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await longRunningApiClient.get('/api/onboarding/tasks/status');
        const sifTask = res?.data?.tasks?.sif_indexing;
        if (!sifTask) return;

        const details = sifTask.details || {};

        if (sifTask.status === 'completed' || details.phase === 'complete') {
          const hasPillars = !!(details.pillars_found && details.pillars_found > 0);
          const hasPages = details.pages_harvested > 0;
          setSifStatus(hasPillars ? 'done' : hasPages ? 'partial' : 'done');
          setSifPhase(hasPillars ? 'complete' : '');
          setSifPageCount(details.pages_harvested ?? null);
          setSifPageTotal(details.pages_total ?? null);
          setSifPillarCount(hasPillars ? details.pillars_found : null);
          setSifLastIndexed(sifTask.started_at || null);
          if (details.indexed_pages?.length) setIndexedPages(details.indexed_pages);
          if (details.harvest_source) setHarvestSource(details.harvest_source);
          if (details.sitemap_total != null) setSitemapTotal(details.sitemap_total);
          if (sifTask.index_freshness_hours != null) setFreshnessHours(sifTask.index_freshness_hours);
        } else if (sifTask.status === 'running') {
          setSifStatus('indexing');
          setSifPhase(details.phase || '');
          setSifPageCount(details.pages_harvested ?? null);
          setSifPageTotal(details.pages_total ?? null);
          if (sifTask.index_freshness_hours != null) setFreshnessHours(sifTask.index_freshness_hours);
        } else if (sifTask.status === 'failed') {
          setSifStatus('error');
          setSifErrorReason(sifTask.failure_reason || null);
        } else if (sifTask.status === 'pending') {
          setSifStatus('idle');
        }
      } catch {
        // Silently ignore poll failures
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetrigger = async () => {
    if (sifRetriggering) return;
    setSifRetriggering(true);
    setSifErrorReason(null);
    setSifStatus('idle');
    try { await apiClient.post('/api/onboarding/sif/retrigger'); }
    catch { /* Non-blocking — poll will pick up status */ }
    finally { setSifRetriggering(false); }
  };

  const bgColor = sifStatus === 'done' ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
    : sifStatus === 'partial' ? 'linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)'
    : sifStatus === 'error' ? 'linear-gradient(135deg, #fef2f2 0%, #fef2f2 100%)'
    : sifStatus === 'indexing' ? 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)'
    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';

  const borderColor = sifStatus === 'done' ? '#bbf7d0'
    : sifStatus === 'partial' ? '#fde68a'
    : sifStatus === 'error' ? '#fecaca'
    : sifStatus === 'indexing' ? '#bfdbfe'
    : '#e2e8f0';

  return (
    <>
      <Paper elevation={2} sx={{ mt: 2.5, p: { xs: 2, md: 2.5 }, borderRadius: 2, background: bgColor, border: `1px solid ${borderColor}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
          {sifStatus === 'done' && <CloudDoneIcon sx={{ color: '#16a34a' }} />}
          {sifStatus === 'partial' && <CloudDoneIcon sx={{ color: '#d97706' }} />}
          {sifStatus === 'error' && <CloudDoneIcon sx={{ color: '#dc2626' }} />}
          {sifStatus === 'indexing' && <CircularProgress size={20} sx={{ color: '#2563eb' }} />}
          {sifStatus === 'idle' && <HourglassEmptyIcon sx={{ color: '#94a3b8' }} />}
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', flex: 1 }}>
            {sifStatus === 'done' && 'SIF Indexing Complete'}
            {sifStatus === 'partial' && 'Pages Indexed — Analysis Pending'}
            {sifStatus === 'error' && 'SIF Indexing Failed'}
            {sifStatus === 'indexing' && `SIF: ${sifPhase ? PHASE_MAP[sifPhase] || sifPhase : 'Indexing in Progress...'}`}
            {sifStatus === 'idle' && 'SIF Indexing Pending'}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#334155', mb: 1.5 }}>
          {sifStatus === 'done' && 'Your website content has been indexed with content pillars identified.'}
          {sifStatus === 'partial' && 'Website content has been indexed but the pillar analysis didn\'t complete. You can retry below.'}
          {sifStatus === 'error' && 'Indexing encountered an error.'}
          {sifStatus === 'indexing' && `ALwrity is analyzing your website in the background — you can continue.`}
          {sifStatus === 'idle' && 'Once you complete the Website step, SIF automatically indexes your content.'}
        </Typography>

        {harvestSource && (sifStatus === 'done' || sifStatus === 'partial') && (
          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>
            Source: {harvestSource} · {freshnessHours != null ? `${freshnessHours}h ago` : ''}
          </Typography>
        )}

        {sifStatus === 'indexing' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} sx={{ color: PHASE_COLORS[sifPhase] || '#2563eb' }} />
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {sifPageCount != null && sifPageTotal != null
                ? `Harvesting ${sifPageCount}/${sifPageTotal} pages...`
                : sifPageCount ? `${sifPageCount} pages found so far...` : 'Starting...'}
            </Typography>
          </Box>
        )}

        {(sifStatus === 'partial' || sifStatus === 'done') && sifPageCount !== null && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: sifStatus === 'partial' ? 2 : 0 }}>
            <Paper
              elevation={0}
              sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${borderColor}`, bgcolor: '#ffffff', minWidth: 140, textAlign: 'center', cursor: indexedPages.length > 0 ? 'pointer' : 'default' }}
              onClick={() => indexedPages.length > 0 && setShowPagesModal(true)}
            >
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Pages</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: sifStatus === 'partial' ? '#d97706' : '#16a34a' }}>{sifPageCount}</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>indexed</Typography>
            </Paper>
            {sitemapTotal != null && sitemapTotal > 0 && (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${borderColor}`, bgcolor: '#ffffff', minWidth: 140, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Sitemap</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>{sitemapTotal}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>URLs found</Typography>
              </Paper>
            )}
            {sifPillarCount !== null && (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${borderColor}`, bgcolor: '#ffffff', minWidth: 140, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Pillars</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#16a34a' }}>{sifPillarCount}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>found</Typography>
              </Paper>
            )}
            {sifLastIndexed && (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${borderColor}`, bgcolor: '#ffffff', minWidth: 140, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Last indexed</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: sifStatus === 'partial' ? '#d97706' : '#16a34a' }}>{new Date(sifLastIndexed).toLocaleDateString()}</Typography>
              </Paper>
            )}
          </Box>
        )}

        {sifStatus === 'partial' && (
          <button onClick={handleRetrigger} disabled={sifRetriggering}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fde68a', background: sifRetriggering ? '#fffbeb' : '#fefce8', color: '#92400e', fontWeight: 600, fontSize: '0.8rem', cursor: sifRetriggering ? 'default' : 'pointer' }}>
            {sifRetriggering ? 'Retrying...' : '🔄 Retry Analysis'}
          </button>
        )}

        {sifStatus === 'error' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption" sx={{ color: '#dc2626' }}>{sifErrorReason || 'An unknown error occurred.'}</Typography>
            <button onClick={handleRetrigger} disabled={sifRetriggering}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fecaca', background: sifRetriggering ? '#fef2f2' : '#fff', color: '#dc2626', fontWeight: 600, fontSize: '0.8rem', cursor: sifRetriggering ? 'default' : 'pointer', alignSelf: 'flex-start' }}>
              {sifRetriggering ? 'Retriggering...' : '🔄 Retrigger Indexing'}
            </button>
          </Box>
        )}
      </Paper>

      {showPagesModal && indexedPages.length > 0 && (
        <div onClick={() => setShowPagesModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, maxWidth: 560, width: '90vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ecf1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Indexed Pages ({indexedPages.length})</h3>
              <button onClick={() => setShowPagesModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
              {/* Test queries */}
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>
                  Test your indexing — click a question to see results:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    'What is the main product?',
                    'Summarize key features',
                    'List the pricing plans',
                    'What industries are targeted?',
                    'How does the platform work?',
                  ].map((q) => (
                    <span
                      key={q}
                      onClick={() => handleTestQuery(q)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0',
                        background: '#fff',
                        fontSize: '0.75rem',
                        color: '#166534',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dcfce7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      {q}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 6 }}>
                  {testQuery ? `Results for "${testQuery}":` : 'Content pillar analysis in progress — these will be searchable once analysis completes.'}
                </div>
                {testResult && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#fff', border: '1px solid #e8ecf1', fontSize: '0.75rem', color: '#334155', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                    {testResult}
                  </div>
                )}
              </div>
              {/* Page list */}
              {indexedPages.map((page, i) => (
                <div key={i} style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid #e8ecf1', background: '#fafbfc' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>{page.title || page.url}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' }}>{page.url}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
