import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useBacklinkOutreachStore } from '../../stores/backlinkOutreachStore';
import {
  bulkUpdateLeadStatus,
  updateLeadStatus,
  addLeadToCampaign,
  fetchCampaignAnalyticsVolume,
  fetchCampaignAnalyticsFunnel,
  CampaignVolumePoint,
  FunnelStage,
  exportCampaignLeadsCsv,
  exportCampaignAttemptsCsv,
  exportCampaignRepliesCsv,
} from '../../api/backlinkOutreachApi';
import { showToastNotification } from '../../utils/toastNotifications';
import LeadsTab from './LeadsTab';
import ComposerTab from './ComposerTab';
import AiProspectModal from './AiProspectModal';
import { useComposerState } from './useComposerState';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

type Tab = 'campaigns' | 'workspace' | 'composer' | 'analytics';

const STATUS_OPTIONS = ['discovered', 'contacted', 'replied', 'placed', 'bounced', 'unsubscribed'] as const;

const STATUS_EXPLANATIONS: Record<string, string> = {
  discovered: 'Lead found but not yet contacted',
  contacted: 'Outreach email has been sent',
  replied: 'Lead has responded to outreach',
  placed: 'Guest post successfully published',
  bounced: 'Email bounced — invalid or inactive',
  unsubscribed: 'Lead opted out of future emails',
};

const GRADIENT_BG = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)';
const GRADIENT_CARD = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))';
const GRADIENT_PRIMARY = 'linear-gradient(135deg, #667eea, #764ba2)';
const GRADIENT_SECONDARY = 'linear-gradient(135deg, #f093fb, #f5576c)';
const GRADIENT_SUCCESS = 'linear-gradient(135deg, #43e97b, #38f9d7)';
const GRADIENT_WARNING = 'linear-gradient(135deg, #fa709a, #fee140)';

// Readable text colors — bumped contrast against dark backgrounds
const TXT_HEADING = '#fff';
const TXT_BODY = 'rgba(255,255,255,0.88)';
const TXT_MUTED = 'rgba(255,255,255,0.6)';
const TXT_FAINT = 'rgba(255,255,255,0.42)';

const TooltipWrap: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          padding: '8px 12px', background: '#1a1a2e', color: '#fff', borderRadius: '8px',
          fontSize: '12px', lineHeight: 1.4, whiteSpace: 'normal', zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', pointerEvents: 'none',
          maxWidth: '280px',
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '6px solid transparent', borderTopColor: '#1a1a2e',
          }} />
        </span>
      )}
    </span>
  );
};

const cardSx: React.CSSProperties = {
  background: GRADIENT_CARD, backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
};

const inputSx: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none',
};

const selectSx: React.CSSProperties = {
  ...inputSx, cursor: 'pointer',
};

const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  fontSize: '14px', padding: '10px 24px', transition: 'all 0.2s',
};

const BacklinkOutreachDashboard: React.FC = () => {
  const { userId } = useAuth();
  const workspaceId = userId || 'default';
  const {
    campaigns, selectedCampaign, discoveredOpportunities,
    discoveryQueries, discoveryEmailStats,
    isLoading, isDiscovering, isAiProspecting, aiProspectResults, error,
    fetchCampaigns, createCampaign, selectCampaign,
    deepDiscover, clearDiscoveries, runAiProspect, clearAiProspect,
    attempts, replies, followups, analytics,
    fetchAttempts, fetchReplies, fetchFollowUps, fetchAnalytics,
    suppressedList, fetchSuppressedList, addSuppressedRecipient, removeSuppressedRecipient,
  } = useBacklinkOutreachStore();

  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [workspaceMode, setWorkspaceMode] = useState<'discover' | 'manage'>('discover');
  const [saveConfirmation, setSaveConfirmation] = useState<{ count: number; campaignName: string } | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [discoverCampaignId, setDiscoverCampaignId] = useState('');

  const [aiProgressStep, setAiProgressStep] = useState(0);
  const [aiProgressLabel, setAiProgressLabel] = useState('');
  useEffect(() => {
    if (!isAiProspecting) return;
    setAiProgressStep(0);
    setAiProgressLabel('Starting AI analysis...');
    const labels = [
      'Scraping page content...',
      'Analyzing with AI for guest post signals...',
      'Extracting editor names and contact info...',
      'Scoring relevance to keyword...',
      'Identifying risk flags...',
      'Generating pitch angles...',
    ];
    const interval = setInterval(() => {
      setAiProgressStep((prev) => {
        const next = Math.min(prev + 1, labels.length);
        setAiProgressLabel(labels[Math.min(next, labels.length - 1)]);
        return next;
      });
    }, 4000);
    return () => {
      clearInterval(interval);
      setAiProgressStep(7);
      setAiProgressLabel('');
    };
  }, [isAiProspecting]);

  const composer = useComposerState({ userId, workspaceId, fetchAttempts, selectCampaign });

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'discovered' | 'contacted' | 'replied' | 'placed' | 'bounced' | 'unsubscribed'>('contacted');

  const [volumeData, setVolumeData] = useState<CampaignVolumePoint[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [discoverPhase, setDiscoverPhase] = useState('');
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ emailFilter: 'all', guidelinesOnly: false, minQuality: 0 });

  const filteredOpportunities = React.useMemo(() => {
    return discoveredOpportunities.filter(opp => {
      if (filters.emailFilter === 'with_email' && !opp.email) return false;
      if (filters.emailFilter === 'no_email' && opp.email) return false;
      if (filters.guidelinesOnly && !opp.has_guest_post_guidelines) return false;
      if (filters.minQuality > 0 && (opp.quality_score * 100) < filters.minQuality) return false;
      return true;
    });
  }, [discoveredOpportunities, filters]);

  const qualifiedCount = React.useMemo(() => {
    return discoveredOpportunities.filter(opp =>
      opp.email && opp.quality_score > 0.3
    ).length;
  }, [discoveredOpportunities]);

  useEffect(() => {
    fetchCampaigns(workspaceId);
  }, [fetchCampaigns, workspaceId]);

  useEffect(() => {
    if (selectedCampaign) {
      const cid = selectedCampaign.campaign_id;
      fetchAttempts(cid);
      fetchReplies(cid);
      fetchFollowUps(cid);
      fetchAnalytics(cid);
    }
  }, [selectedCampaign, fetchAttempts, fetchReplies, fetchFollowUps, fetchAnalytics]);

  useEffect(() => {
    if (!selectedCampaign) return;
    let cancelled = false;
    setIsAnalyticsLoading(true);
    Promise.all([
      fetchCampaignAnalyticsVolume(selectedCampaign.campaign_id, analyticsDays),
      fetchCampaignAnalyticsFunnel(selectedCampaign.campaign_id),
    ]).then(([vol, funnel]) => {
      if (!cancelled) {
        setVolumeData(vol.volume);
        setFunnelData(funnel.stages);
        setIsAnalyticsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        showToastNotification('Failed to load analytics data', 'error');
        setIsAnalyticsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [analyticsDays, selectedCampaign?.campaign_id]);

  useEffect(() => {
    if (!isDiscovering) {
      setDiscoverPhase('');
      return;
    }
    const phases = [
      'Generating guest post search queries...',
      'Searching Exa neural index and DuckDuckGo...',
      'Scraping page content for guest post signals...',
      'Extracting contact emails and contact pages...',
      'Scoring, deduplicating, and ranking opportunities...',
    ];
    let idx = 0;
    setDiscoverPhase(phases[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setDiscoverPhase(phases[idx]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isDiscovering]);

  const handleCreateCampaign = useCallback(async () => {
    if (!newCampaignName.trim()) return;
    const name = newCampaignName.trim();
    const id = await createCampaign(workspaceId, name);
    if (id) {
      setNewCampaignName('');
      setKeyword(name);
      setDiscoverCampaignId(id);
      await selectCampaign(id);
      setActiveTab('workspace');
      setWorkspaceMode('discover');
    }
  }, [newCampaignName, createCampaign, selectCampaign]);

  const handleDiscover = useCallback(async () => {
    if (!keyword.trim()) return;
    await deepDiscover(keyword.trim(), 15, discoverCampaignId || undefined);
    if (discoverCampaignId) {
      selectCampaign(discoverCampaignId);
      showToastNotification('Discover complete — leads saved to campaign', 'success');
    }
  }, [keyword, deepDiscover, discoverCampaignId, selectCampaign]);

  const handleDiscoverAndSave = useCallback(async () => {
    const toSave = showFilters ? filteredOpportunities : discoveredOpportunities;
    if (!keyword.trim() || !discoverCampaignId || toSave.length === 0) return;
    for (const opp of toSave) {
      try {
        await addLeadToCampaign(discoverCampaignId, {
          campaign_id: discoverCampaignId,
          url: opp.url,
          domain: opp.domain,
          page_title: opp.page_title,
          snippet: opp.snippet,
          email: opp.email ?? undefined,
          confidence_score: opp.confidence_score,
          exa_author: opp.exa_author ?? undefined,
          exa_published_date: opp.exa_published_date ?? undefined,
          exa_summary: opp.exa_summary ?? undefined,
          ai_editor_name: opp.ai_editor_name ?? undefined,
          ai_pitch_angle: opp.ai_pitch_angle ?? undefined,
          ai_guidelines_summary: opp.ai_guidelines_summary ?? undefined,
          ai_relevance_score: opp.ai_relevance_score ?? undefined,
          ai_risk_flags: opp.ai_risk_flags ? JSON.stringify(opp.ai_risk_flags) : undefined,
        });
      } catch (e) {
        // skip duplicates
      }
    }
    await selectCampaign(discoverCampaignId);
    const campaign = campaigns.find(c => c.campaign_id === discoverCampaignId);
    setSaveConfirmation({ count: toSave.length, campaignName: campaign?.name || discoverCampaignId });
    showToastNotification(`Saved ${toSave.length} leads to campaign`, 'success');
    setActiveTab('workspace');
    setWorkspaceMode('manage');
  }, [keyword, discoverCampaignId, discoveredOpportunities, filteredOpportunities, showFilters, selectCampaign, campaigns]);

  const handleSelectCampaign = useCallback(async (campaignId: string) => {
    await selectCampaign(campaignId);
    setActiveTab('workspace');
    setWorkspaceMode('manage');
  }, [selectCampaign]);

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleAllLeads = () => {
    if (!selectedCampaign || !selectedCampaign.leads) return;
    const all = selectedCampaign.leads;
    setSelectedLeadIds(prev =>
      prev.size === all.length ? new Set() : new Set(all.map(l => l.lead_id))
    );
  };

  const handleSingleStatusUpdate = async (leadId: string, status: 'discovered' | 'contacted' | 'replied' | 'placed' | 'bounced' | 'unsubscribed') => {
    setIsStatusUpdating(true);
    try {
      await updateLeadStatus(leadId, {
        status,
        campaign_id: selectedCampaign!.campaign_id,
      });
      showToastNotification(`Status updated to "${status}"`, 'success');
      await selectCampaign(selectedCampaign!.campaign_id);
    } catch (e) {
      showToastNotification('Status update failed', 'error');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedLeadIds.size === 0) return;
    setIsStatusUpdating(true);
    try {
      const result = await bulkUpdateLeadStatus({
        lead_ids: Array.from(selectedLeadIds),
        status: bulkStatus,
        campaign_id: selectedCampaign!.campaign_id,
      });
      if (result.failed.length > 0) {
        showToastNotification(`Updated ${result.updated} leads; ${result.failed.length} failed`, 'warning');
      } else {
        showToastNotification(`Updated ${result.updated} leads to "${bulkStatus}"`, 'success');
      }
      setSelectedLeadIds(new Set());
      await selectCampaign(selectedCampaign!.campaign_id);
    } catch (e) {
      showToastNotification('Bulk status update failed', 'error');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleExportCsv = useCallback(async (type: 'leads' | 'attempts' | 'replies') => {
    if (!selectedCampaign || isExporting) return;
    setIsExporting(type);
    try {
      const fn = type === 'leads' ? exportCampaignLeadsCsv : type === 'attempts' ? exportCampaignAttemptsCsv : exportCampaignRepliesCsv;
      const blob = await fn(selectedCampaign.campaign_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selectedCampaign.campaign_id}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToastNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} exported`, 'success');
    } catch (e: any) {
      showToastNotification(e?.message || 'Export failed', 'error');
    } finally {
      setIsExporting(null);
    }
  }, [selectedCampaign, isExporting]);

  const handleSendToLead = useCallback((lead: any) => {
    return composer.handleSendToLead(lead, selectedCampaign);
  }, [composer.handleSendToLead, selectedCampaign]);

const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  const renderStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; fg: string }> = {
      discovered: { bg: 'rgba(102,126,234,0.2)', fg: '#8b9cf7' },
      contacted: { bg: 'rgba(240,147,251,0.2)', fg: '#f093fb' },
      replied: { bg: 'rgba(67,233,123,0.2)', fg: '#43e97b' },
      placed: { bg: 'rgba(67,233,123,0.3)', fg: '#38f9d7' },
      bounced: { bg: 'rgba(245,87,108,0.2)', fg: '#f5576c' },
      unsubscribed: { bg: 'rgba(254,225,64,0.15)', fg: '#fee140' },
    };
    const s = styles[status] || { bg: 'rgba(255,255,255,0.1)', fg: '#aaa' };
    return (
      <TooltipWrap text={STATUS_EXPLANATIONS[status] || ''}>
        <span style={{
          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
          background: s.bg, color: s.fg, border: `1px solid ${s.fg}33`,
        }}>{status}</span>
      </TooltipWrap>
    );
  };

  const tabMeta: { key: Tab; label: string; desc: string }[] = [
    { key: 'campaigns', label: 'Campaigns', desc: 'Create and manage outreach campaigns' },
    { key: 'workspace', label: 'Workspace', desc: 'Discover opportunities and manage leads in one view' },
    { key: 'composer', label: 'Composer', desc: 'AI email composer with compliance metadata' },
    { key: 'analytics', label: 'Analytics', desc: 'Campaign performance metrics and exports' },
  ];


  const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ margin: 0, background: GRADIENT_PRIMARY, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '18px' }}>{title}</h3>
      <p style={{ margin: '4px 0 0', fontSize: '14px', color: TXT_BODY }}>{subtitle}</p>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: GRADIENT_BG,
      padding: '32px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            margin: 0, fontSize: '28px', fontWeight: 700,
            background: GRADIENT_PRIMARY, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Backlink Outreach</h1>
          <p style={{ margin: '6px 0 0', color: TXT_BODY, fontSize: '15px' }}>
            AI-powered guest post outreach platform — discover opportunities, manage campaigns, compose emails, and track results.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap', padding: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
          {tabMeta.map(({ key, label, desc }) => (
            <TooltipWrap key={key} text={desc}>
              <button onClick={() => handleTabChange(key)}
                style={{
                  ...btnBase, padding: '10px 20px', fontSize: '13px',
                  background: activeTab === key ? GRADIENT_PRIMARY : 'transparent',
                  color: activeTab === key ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: activeTab === key ? '0 4px 15px rgba(102,126,234,0.4)' : 'none',
                }}>
                {label}
              </button>
            </TooltipWrap>
          ))}
        </div>

        {error && (
          <div style={{ padding: '14px 18px', background: 'rgba(245,87,108,0.15)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '10px', color: '#f5576c', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* === CAMPAIGNS TAB === */}
        {activeTab === 'campaigns' && (
          <div style={{ ...cardSx, padding: '24px' }}>
            <SectionHeader title="Campaigns" subtitle="Organize your outreach efforts into campaigns. Each campaign groups leads, emails, and analytics together." />
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input type="text" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="Enter campaign name (e.g. 'Tech Bloggers Q3')"
                style={{ ...inputSx, flex: 1 }} />
              <TooltipWrap text="Creates a new campaign and takes you to the Discover tab to find leads">
                <button onClick={handleCreateCampaign} disabled={!newCampaignName.trim() || isLoading}
                  style={{ ...btnBase, background: GRADIENT_PRIMARY, color: '#fff', opacity: !newCampaignName.trim() || isLoading ? 0.5 : 1 }}>
                  {isLoading ? 'Creating...' : 'Create Campaign'}
                </button>
              </TooltipWrap>
            </div>
            {campaigns.length === 0 && !isLoading && (
              <p style={{ color: TXT_FAINT, textAlign: 'center', padding: '40px 0' }}>
                No campaigns yet. Create one above to get started.
              </p>
            )}
            {campaigns.map((c) => (
              <TooltipWrap key={c.campaign_id} text="Click to view leads and manage this campaign">
                <div onClick={() => handleSelectCampaign(c.campaign_id)}
                  style={{
                    padding: '16px', marginBottom: '8px', borderRadius: '10px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{c.name}</div>
                  <div style={{ fontSize: '13px', color: TXT_MUTED, marginTop: '4px' }}>
                    Status: {c.status} {c.created_at && <> &middot; Created {new Date(c.created_at).toLocaleDateString()}</>}
                  </div>
                </div>
              </TooltipWrap>
            ))}
            {isLoading && <p style={{ color: TXT_MUTED }}>Loading...</p>}
          </div>
        )}

        {/* === WORKSPACE TAB === */}
        {activeTab === 'workspace' && (
          <div>
            {/* Sub-mode toggle */}
            <div style={{ display: 'inline-flex', gap: '4px', marginBottom: '16px', padding: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px' }}>
              <button onClick={() => setWorkspaceMode('discover')}
                style={{ ...btnBase, padding: '8px 20px', fontSize: '13px', background: workspaceMode === 'discover' ? GRADIENT_PRIMARY : 'transparent', color: workspaceMode === 'discover' ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Discover
              </button>
              <button onClick={() => setWorkspaceMode('manage')}
                style={{ ...btnBase, padding: '8px 20px', fontSize: '13px', background: workspaceMode === 'manage' ? GRADIENT_PRIMARY : 'transparent', color: workspaceMode === 'manage' ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Manage Leads
              </button>
            </div>

            {workspaceMode === 'discover' && (
              <div style={{ ...cardSx, padding: '24px' }}>
                <SectionHeader title="Discover Opportunities" subtitle="AI searches the web using Exa neural search + DuckDuckGo to find websites accepting guest posts in your niche." />
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. 'AI marketing', 'SaaS growth', 'digital nomad'"
                style={{ ...inputSx, flex: 1, minWidth: '220px' }} />
              <TooltipWrap text="Searches multiple guest-post query patterns (e.g. 'write for us', 'guest contributor') across search engines">
                <button onClick={handleDiscover} disabled={!keyword.trim() || isDiscovering}
                  style={{ ...btnBase, background: GRADIENT_SUCCESS, color: '#1a1a2e', opacity: !keyword.trim() || isDiscovering ? 0.5 : 1 }}>
                  {isDiscovering ? 'Searching...' : 'Discover'}
                </button>
              </TooltipWrap>
            </div>

            {/* Search queries used */}
            {keyword.trim() && !isDiscovering && discoveryQueries.length > 0 && (
              <details style={{ marginBottom: '16px', fontSize: '13px', color: TXT_MUTED }}>
                <summary style={{ cursor: 'pointer', marginBottom: '6px', fontWeight: 500 }}>Search queries used ({discoveryQueries.length})</summary>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {discoveryQueries.map((q, i) => (
                    <span key={i} style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      color: TXT_BODY,
                    }}>{q}</span>
                  ))}
                </div>
              </details>
            )}

            {/* Email extraction methodology info */}
            {keyword.trim() && !isDiscovering && (
              <details style={{ marginBottom: '16px', fontSize: '13px', color: TXT_MUTED }}>
                <summary style={{ cursor: 'pointer', marginBottom: '6px', fontWeight: 500 }}>How email extraction works</summary>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 8px', color: TXT_BODY }}>Emails are extracted in 3 stages for each discovered page:</p>
                  <ol style={{ margin: 0, paddingLeft: '20px', color: TXT_MUTED }}>
                    <li><strong style={{ color: TXT_HEADING }}>Page text scan</strong> — regex for standard emails, <code>mailto:</code> links, and obfuscated patterns (e.g. <code>user [at] example [dot] com</code>)</li>
                    <li><strong style={{ color: TXT_HEADING }}>Contact page follow</strong> — if a /contact, /about, or /team page is found, it's scraped for additional emails</li>
                    <li><strong style={{ color: TXT_HEADING }}>Tavily search</strong> — if no email found yet, searches <code>{`"{domain} email address contact"`}</code> via Tavily API</li>
                  </ol>
                </div>
              </details>
            )}
            {discoveredOpportunities.length > 0 && !isDiscovering && (
              <details style={{ marginBottom: '16px', cursor: 'pointer' }}>
                <summary style={{ color: TXT_MUTED, fontSize: '13px', padding: '8px 0', userSelect: 'none' }}>
                  Deep analysis details — {discoveredOpportunities.length} URLs scanned
                  {showFilters && <span style={{ marginLeft: '8px', color: '#8b9cf7' }}>({filteredOpportunities.length} shown)</span>}
                </summary>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  {discoveryEmailStats && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '12px' }}>
                      <span>Total URLs: <strong style={{ color: '#fff' }}>{discoveryEmailStats.total}</strong></span>
                      <span>With emails: <strong style={{ color: '#43e97b' }}>{discoveryEmailStats.with_email}</strong></span>
                      <span>Total emails found: <strong style={{ color: '#8b9cf7' }}>{discoveryEmailStats.total_emails_found}</strong></span>
                      <span>From page text: <strong style={{ color: '#f39c12' }}>{discoveryEmailStats.from_regex}</strong></span>
                      <span>From contact pages: <strong style={{ color: '#43e97b' }}>{discoveryEmailStats.from_contact_page}</strong></span>
                      <span>From Tavily search: <strong style={{ color: '#8b9cf7' }}>{discoveryEmailStats.from_tavily}</strong></span>
                      {discoveryEmailStats.from_guessed > 0 && <span>From AI guess: <strong style={{ color: '#e74c3c' }}>{discoveryEmailStats.from_guessed}</strong></span>}
                      {discoveryEmailStats.total > 0 && (
                        <span>Success rate: <strong style={{ color: (discoveryEmailStats.with_email / discoveryEmailStats.total) > 0.3 ? '#43e97b' : '#f39c12' }}>
                          {(discoveryEmailStats.with_email / discoveryEmailStats.total * 100).toFixed(0)}%
                        </strong></span>
                      )}
                    </div>
                  )}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.06)', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>#</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Domain</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Email</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Contact</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Guidelines</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Source</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Quality</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Score</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Published</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Author</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: TXT_MUTED, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>AI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOpportunities.map((opp, i) => {
                          const src = opp.discovery_source || '';
                          let srcLabel = src;
                          if (src.startsWith('exa')) srcLabel = src.replace(/^exa[+]?/, '') || 'Exa search';
                          else if (src.startsWith('duckduckgo')) srcLabel = src.replace(/^duckduckgo[+]?/, '') || 'DuckDuckGo';
                          if (srcLabel && src.includes('+ai')) srcLabel += ' + AI';
                          return (
                          <tr key={i} style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                          }}>
                            <td style={{ padding: '6px 10px', color: TXT_FAINT }}>{i + 1}</td>
                            <td style={{ padding: '6px 10px', color: TXT_BODY, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <TooltipWrap text={opp.url}>
                                <span>{opp.domain}</span>
                              </TooltipWrap>
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: opp.email ? '#43e97b' : TXT_FAINT }}>
                              {opp.email ? '✓' : '—'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: opp.contact_page ? '#8b9cf7' : TXT_FAINT }}>
                              {opp.contact_page ? '✓' : '—'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: opp.has_guest_post_guidelines ? '#43e97b' : TXT_FAINT }}>
                              {opp.has_guest_post_guidelines ? '✓' : '—'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: TXT_MUTED, fontSize: '11px' }}>
                              {srcLabel || 'exa'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <span style={{ color: opp.quality_score > 0.5 ? '#43e97b' : '#f39c12' }}>
                                {(opp.quality_score * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {opp.exa_score !== undefined ? (
                                <span style={{ color: opp.exa_score > 0.5 ? '#43e97b' : '#f39c12', fontSize: '11px' }}>
                                  {(opp.exa_score * 100).toFixed(0)}%
                                </span>
                              ) : <span style={{ color: TXT_FAINT }}>—</span>}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: TXT_MUTED, fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {opp.exa_published_date ? (
                                <TooltipWrap text={opp.exa_published_date}>
                                  <span>{new Date(opp.exa_published_date).toLocaleDateString()}</span>
                                </TooltipWrap>
                              ) : <span style={{ color: TXT_FAINT }}>—</span>}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: TXT_MUTED, fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {opp.exa_author ? (
                                <TooltipWrap text={opp.exa_author}>
                                  <span>{opp.exa_author}</span>
                                </TooltipWrap>
                              ) : <span style={{ color: TXT_FAINT }}>—</span>}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {opp.ai_prospected ? <span style={{ color: '#8b9cf7', fontSize: '11px' }}>✓</span> : <span style={{ color: TXT_FAINT }}>—</span>}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            )}

            {isDiscovering && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                <div style={{ color: TXT_BODY, fontSize: '13px' }}>
                  {discoverPhase || 'Searching...'}
                </div>
                <div style={{ color: TXT_FAINT, fontSize: '12px', marginTop: '6px' }}>
                  This may take 15–30 seconds depending on results
                </div>
              </div>
            )}
            {discoveredOpportunities.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{discoveredOpportunities.length} opportunities</span>
                    <span style={{ marginLeft: '8px', fontSize: '13px', color: '#43e97b' }}>
                      {qualifiedCount} qualified
                    </span>
                    {discoveryEmailStats && (
                      <span style={{ marginLeft: '12px', fontSize: '13px', color: TXT_MUTED }}>
                        {discoveryEmailStats.with_email > 0
                          ? `${discoveryEmailStats.with_email} with emails · ${discoveryEmailStats.total_emails_found} total · ${discoveryEmailStats.from_regex} text, ${discoveryEmailStats.from_contact_page} contact, ${discoveryEmailStats.from_tavily} search, ${discoveryEmailStats.from_guessed} guessed`
                          : 'No emails found yet'}
                      </span>
                    )}
                  </div>
                  {/* Next-steps guidance */}
                  <div style={{
                    padding: '10px 14px', marginBottom: '12px', borderRadius: '8px',
                    background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)',
                    fontSize: '13px', color: TXT_MUTED, lineHeight: 1.5,
                  }}>
                    <strong style={{ color: '#8b9cf7' }}>Next steps:</strong>{' '}
                    Select a campaign above, then click <strong style={{ color: '#fff' }}>Save to Campaign</strong> to store leads, or{' '}
                    <strong style={{ color: '#fff' }}>AI Prospecting</strong> for deeper LLM analysis.
                    Use <strong style={{ color: '#fff' }}>Filters</strong> to narrow results.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <TooltipWrap text="Toggle filter panel to narrow down opportunities">
                      <button onClick={() => setShowFilters(p => !p)}
                        style={{ ...btnBase, padding: '8px 12px', fontSize: '13px', background: showFilters ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.06)', color: showFilters ? '#8b9cf7' : TXT_BODY, border: showFilters ? '1px solid rgba(102,126,234,0.3)' : '1px solid transparent' }}>
                        Filters {showFilters ? '▲' : '▼'}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Save discovered leads directly to a campaign for tracking">
                      <select value={discoverCampaignId} onChange={(e) => setDiscoverCampaignId(e.target.value)}
                        style={{ ...selectSx, padding: '8px 12px', fontSize: '13px', minWidth: '160px' }}>
                        <option value="">-- Select campaign --</option>
                        {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
                      </select>
                    </TooltipWrap>
                    <TooltipWrap text={showFilters ? `Saves ${filteredOpportunities.length} visible leads` : 'Saves all discovered leads'}>
                      <button onClick={handleDiscoverAndSave}
                        disabled={!keyword.trim() || !discoverCampaignId || (showFilters && filteredOpportunities.length === 0)}
                        style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: GRADIENT_PRIMARY, color: '#fff', opacity: discoverCampaignId && (!showFilters || filteredOpportunities.length > 0) ? 1 : 0.4 }}>
                        {showFilters ? `Save ${filteredOpportunities.length} to Campaign` : 'Save to Campaign'}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Uses AI to deep-analyze each opportunity — extract emails, assess site activity, get pitch angles">
                      <button onClick={() => runAiProspect(keyword)}
                        disabled={isAiProspecting}
                        style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', opacity: isAiProspecting ? 0.6 : 1 }}>
                        {isAiProspecting ? 'AI Analyzing...' : 'AI Prospecting'}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Clears current search results">
                      <button onClick={clearDiscoveries}
                        style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: 'rgba(255,255,255,0.06)', color: TXT_BODY }}>
                        Clear
                      </button>
                    </TooltipWrap>
                  </div>
                </div>

                {showFilters && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                    <span style={{ color: TXT_MUTED }}>Email:</span>
                    <select value={filters.emailFilter} onChange={(e) => setFilters(f => ({ ...f, emailFilter: e.target.value }))}
                      style={{ ...selectSx, padding: '6px 10px', fontSize: '13px', minWidth: '100px', width: 'auto' }}>
                      <option value="all">All</option>
                      <option value="with_email">Has email</option>
                      <option value="no_email">No email</option>
                    </select>
                    <label style={{ color: TXT_MUTED, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={filters.guidelinesOnly}
                        onChange={(e) => setFilters(f => ({ ...f, guidelinesOnly: e.target.checked }))}
                        style={{ accentColor: '#667eea' }} />
                      Guidelines only
                    </label>
                    <span style={{ color: TXT_MUTED }}>Min Quality:</span>
                    <input type="range" min={0} max={100} value={filters.minQuality}
                      onChange={(e) => setFilters(f => ({ ...f, minQuality: Number(e.target.value) }))}
                      style={{ width: '120px', accentColor: '#667eea', verticalAlign: 'middle' }} />
                    <span style={{ color: '#fff', minWidth: '32px' }}>{filters.minQuality}%</span>
                    {filters.emailFilter !== 'all' || filters.guidelinesOnly || filters.minQuality > 0 ? (
                      <button onClick={() => setFilters({ emailFilter: 'all', guidelinesOnly: false, minQuality: 0 })}
                        style={{ ...btnBase, padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: TXT_MUTED }}>
                        Reset
                      </button>
                    ) : null}
                    <span style={{ color: TXT_FAINT, marginLeft: 'auto', fontSize: '12px' }}>
                      Showing {filteredOpportunities.length} of {discoveredOpportunities.length}
                    </span>
                  </div>
                )}

                {filteredOpportunities.map((opp, i) => {
                  const aiRiskFlags = opp.ai_risk_flags;
                  const aiSiteActive = opp.ai_site_active;
                  const aiAcceptsGuestPosts = opp.ai_accepts_guest_posts;
                  const aiPitchAngle = opp.ai_pitch_angle;
                  const aiEditorName = opp.ai_editor_name;
                  const aiGuidelinesSummary = opp.ai_guidelines_summary;
                  const aiRelevanceScore = opp.ai_relevance_score;
                  const aiProspected = opp.ai_prospected;
                  const hasAiData = aiProspected && (aiRiskFlags || aiSiteActive !== undefined || aiAcceptsGuestPosts !== undefined || aiPitchAngle);

                  return (
                  <div key={`${opp.url}-${i}`} style={{
                    padding: '16px', marginBottom: '8px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      <a href={opp.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#8b9cf7', textDecoration: 'none' }}>
                        {opp.page_title || opp.domain}
                      </a>
                      {aiProspected && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(102,126,234,0.2)', color: '#8b9cf7' }}>AI</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: TXT_MUTED, marginBottom: '4px' }}>{opp.domain}</div>
                    {opp.snippet && <div style={{ fontSize: '13px', color: TXT_BODY, marginBottom: '8px' }}>{opp.snippet.slice(0, 200)}...</div>}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', flexWrap: 'wrap' }}>
                      <TooltipWrap text="How relevant this site is to your keyword based on content analysis">
                        <span style={{ color: TXT_MUTED }}>Quality: <strong style={{ color: '#43e97b' }}>{(opp.quality_score * 100).toFixed(0)}%</strong></span>
                      </TooltipWrap>
                      {opp.exa_score !== undefined && (
                        <TooltipWrap text="Exa relevance score (0–1) from semantic search">
                          <span style={{ color: TXT_MUTED }}>Exa Score: <strong style={{ color: opp.exa_score > 0.5 ? '#43e97b' : '#f39c12' }}>{(opp.exa_score * 100).toFixed(0)}%</strong></span>
                        </TooltipWrap>
                      )}
                      <TooltipWrap text="Confidence that this site accepts guest posts, based on page signals">
                        <span style={{ color: TXT_MUTED }}>Confidence: <strong style={{ color: '#8b9cf7' }}>{(opp.confidence_score * 100).toFixed(0)}%</strong></span>
                      </TooltipWrap>
                      {hasAiData && aiRelevanceScore !== undefined && (
                        <TooltipWrap text="AI-assessed relevance to your search keyword">
                          <span style={{ color: TXT_MUTED }}>AI Relevance: <strong style={{ color: aiRelevanceScore > 0.5 ? '#43e97b' : '#f39c12' }}>{(aiRelevanceScore * 100).toFixed(0)}%</strong></span>
                        </TooltipWrap>
                      )}
                      {opp.has_guest_post_guidelines && (
                        <TooltipWrap text="This site has a dedicated guest post guidelines page">
                          <span style={{ color: '#43e97b' }}>Has guidelines</span>
                        </TooltipWrap>
                      )}
                      {hasAiData && aiAcceptsGuestPosts !== undefined && (
                        <TooltipWrap text="AI assessment: whether this site accepts guest posts">
                          <span style={{ color: aiAcceptsGuestPosts ? '#43e97b' : TXT_FAINT }}>
                            {aiAcceptsGuestPosts ? 'Accepts guest posts' : 'No guest post signal'}
                          </span>
                        </TooltipWrap>
                      )}
                      {opp.email ? (
                        <TooltipWrap text={`Email found via ${opp.discovery_source || 'page text'}: ${opp.email}`}>
                          <span style={{ color: '#8b9cf7' }}>Email: {opp.email}</span>
                        </TooltipWrap>
                      ) : (
                        <TooltipWrap text="No email address found on this page. Try AI Prospecting for deeper extraction.">
                          <span style={{ color: TXT_FAINT }}>No email found</span>
                        </TooltipWrap>
                      )}
                      {opp.contact_page && (
                        <TooltipWrap text="Contact page URL detected — will be scraped for emails on save">
                          <span style={{ color: TXT_MUTED, fontSize: '12px' }}>Contact page found</span>
                        </TooltipWrap>
                      )}
                    </div>
                    {(opp.exa_published_date || opp.exa_author || opp.exa_summary || (opp.exa_highlights && opp.exa_highlights.length > 0)) && (
                      <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: 'rgba(139,156,247,0.06)', border: '1px solid rgba(139,156,247,0.12)', fontSize: '13px' }}>
                        {opp.exa_published_date && <div style={{ color: TXT_MUTED, marginBottom: '4px' }}>Published: {opp.exa_published_date}</div>}
                        {opp.exa_author && <div style={{ color: TXT_MUTED, marginBottom: '4px' }}>Author: {opp.exa_author}</div>}
                        {opp.exa_summary && <div style={{ color: TXT_BODY, marginBottom: '4px' }}>{opp.exa_summary}</div>}
                        {opp.exa_highlights && opp.exa_highlights.length > 0 && (
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', color: TXT_BODY }}>
                            {opp.exa_highlights.slice(0, 3).map((h: string, hi: number) => (
                              <li key={hi} style={{ marginBottom: '2px' }}>{h}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {hasAiData && (
                      <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.15)', fontSize: '13px' }}>
                        {aiPitchAngle && <div style={{ color: TXT_HEADING, marginBottom: '6px', fontStyle: 'italic' }}>"{aiPitchAngle}"</div>}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {aiSiteActive !== undefined && (
                            <span style={{ color: aiSiteActive ? '#43e97b' : '#e74c3c' }}>
                              {aiSiteActive ? 'Active site' : 'Inactive'}
                            </span>
                          )}
                          {aiEditorName && <span style={{ color: TXT_BODY }}>Editor: {aiEditorName}</span>}
                          {aiRiskFlags && aiRiskFlags.length > 0 && aiRiskFlags.map((flag: string) => (
                            <span key={flag} style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', fontSize: '12px' }}>
                              {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                        {aiGuidelinesSummary && <div style={{ marginTop: '6px', color: TXT_MUTED }}>{aiGuidelinesSummary}</div>}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
            {!isDiscovering && discoveredOpportunities.length === 0 && (
              <p style={{ color: TXT_FAINT, textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
                No results yet.
              </p>
            )}
            {!isDiscovering && discoveredOpportunities.length > 0 && filteredOpportunities.length === 0 && (
              <p style={{ color: TXT_FAINT, textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
                No opportunities match the current filters.
                <button onClick={() => setFilters({ emailFilter: 'all', guidelinesOnly: false, minQuality: 0 })}
                  style={{ marginLeft: '8px', ...btnBase, padding: '4px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: '#8b9cf7' }}>
                  Reset filters
                </button>
              </p>
            )}
          </div>
        )}

            {workspaceMode === 'manage' && (
              <>
                {saveConfirmation && (
                  <div style={{
                    padding: '16px 20px', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(67,233,123,0.12), rgba(56,249,215,0.08))',
                    border: '1px solid rgba(67,233,123,0.25)',
                    borderRadius: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#43e97b', marginBottom: '4px' }}>
                          {saveConfirmation.count} leads saved to "{saveConfirmation.campaignName}"
                        </div>
                        <div style={{ fontSize: '13px', color: TXT_BODY, lineHeight: 1.5, marginBottom: '10px' }}>
                          What would you like to do next?
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => { setActiveTab('composer'); setSaveConfirmation(null); }}
                            style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: GRADIENT_PRIMARY, color: '#fff' }}>
                            Compose Email to Send
                          </button>
                          <button onClick={() => setSaveConfirmation(null)}
                            style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: 'rgba(255,255,255,0.08)', color: TXT_BODY }}>
                            Review Saved Leads
                          </button>
                          <button onClick={() => { setWorkspaceMode('discover'); setSaveConfirmation(null); }}
                            style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: 'rgba(255,255,255,0.06)', color: TXT_MUTED }}>
                            Find More Opportunities
                          </button>
                        </div>
                      </div>
                      <button onClick={() => setSaveConfirmation(null)}
                        style={{ ...btnBase, padding: '4px 10px', fontSize: '16px', background: 'transparent', color: TXT_FAINT, lineHeight: 1 }}>
                        x
                      </button>
                    </div>
                  </div>
                )}
                <LeadsTab
                  campaigns={campaigns}
                  selectedCampaign={selectedCampaign}
                  analytics={analytics}
                  attempts={attempts}
                  replies={replies}
                  followups={followups}
                  selectedLeadIds={selectedLeadIds}
                  bulkStatus={bulkStatus}
                  isStatusUpdating={isStatusUpdating}
                  isExporting={isExporting}
                   sendingLeadId={composer.sendingLeadId}
                   subject={composer.subject}
                   body={composer.body}
                  onSelectCampaign={handleSelectCampaign}
                  onSendToLead={handleSendToLead}
                  onSingleStatusUpdate={handleSingleStatusUpdate}
                  onBulkStatusUpdate={handleBulkStatusUpdate}
                  onToggleLeadSelection={toggleLeadSelection}
                  onToggleAllLeads={toggleAllLeads}
                  onExportCsv={handleExportCsv}
                  onGoToCampaigns={() => setActiveTab('campaigns')}
                  onGoToDiscover={() => { setActiveTab('workspace'); setWorkspaceMode('discover'); }}
                  onSetBulkStatus={setBulkStatus as any}
                />
              </>
            )}
          </div>
        )}

        {/* === COMPOSER TAB === */}
        {activeTab === 'composer' && (
          <ComposerTab
            composer={composer}
            keyword={keyword}
            suppressedList={suppressedList}
            selectedCampaign={selectedCampaign}
            onFetchSuppressedList={fetchSuppressedList}
            onAddSuppressedRecipient={addSuppressedRecipient}
            onRemoveSuppressedRecipient={removeSuppressedRecipient}
            onGoToLeads={() => { setActiveTab('workspace'); setWorkspaceMode('manage'); }}
          />
        )}

        {/* === ANALYTICS TAB === */}
        {activeTab === 'analytics' && (
          <div style={{ ...cardSx, padding: '24px' }}>
            {selectedCampaign ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff' }}>{selectedCampaign.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: TXT_MUTED }}>Performance analytics & reporting</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <TooltipWrap text="Choose the time range for send volume data">
                      <select value={analyticsDays} onChange={(e) => setAnalyticsDays(Number(e.target.value))}
                        style={{ ...selectSx, padding: '8px 12px', fontSize: '13px' }}>
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                    </TooltipWrap>
                    <TooltipWrap text="Switch to a different campaign">
                      <select onChange={(e) => { const c = campaigns.find(x => x.campaign_id === e.target.value); if (c) selectCampaign(c.campaign_id); }}
                        value={selectedCampaign.campaign_id}
                        style={{ ...selectSx, padding: '8px 12px', fontSize: '13px', minWidth: '180px' }}>
                        {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
                      </select>
                    </TooltipWrap>
                  </div>
                </div>

                {analytics && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {[{ label: 'Sent', value: analytics.send_volume, grad: GRADIENT_PRIMARY, desc: 'Total outreach emails sent' },
                      { label: 'Response Rate', value: `${(analytics.response_rate * 100).toFixed(1)}%`, grad: GRADIENT_SUCCESS, desc: 'Percentage of sent emails that received a reply' },
                      { label: 'Replies', value: analytics.reply_count, grad: GRADIENT_WARNING, desc: 'Total replies received from leads' },
                      { label: 'Placement Rate', value: `${(analytics.placement_rate * 100).toFixed(1)}%`, grad: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', desc: 'Percentage of leads that resulted in a published post' },
                      { label: 'Blocked', value: analytics.blocked_count, grad: GRADIENT_SECONDARY, desc: 'Emails blocked by policy (suppression, caps, etc.)' },
                    ].map(({ label, value, grad, desc }) => (
                      <TooltipWrap key={label} text={desc}>
                        <div style={{
                          flex: 1, minWidth: '110px', padding: '16px', borderRadius: '10px', textAlign: 'center',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <div style={{ fontSize: '24px', fontWeight: 700, background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{value}</div>
                          <div style={{ fontSize: '11px', color: TXT_MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                        </div>
                      </TooltipWrap>
                    ))}
                  </div>
                )}

                {isAnalyticsLoading && <p style={{ color: TXT_MUTED, textAlign: 'center', padding: '20px' }}>Loading analytics data...</p>}

                {/* Volume chart */}
                {volumeData.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Send Volume Trend" subtitle={`Daily outreach email send volume over the last ${analyticsDays} days.`} />
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={volumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <RechartsTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                          <Line type="monotone" dataKey="count" stroke="#667eea" strokeWidth={2} dot={{ r: 3, fill: '#667eea' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Funnel chart */}
                {funnelData.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Lead Conversion Funnel" subtitle="Breakdown of leads by status stage. Shows where leads are in the outreach pipeline." />
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={funnelData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="status" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <RechartsTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                          <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Reply classification */}
                {analytics && Object.keys(analytics.reply_classification).length > 0 && (
                  <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <SectionHeader title="Reply Classification Breakdown" subtitle="Categorization of replies by type — positive, negative, neutral, or out-of-office." />
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {Object.entries(analytics.reply_classification).map(([cls, count]) => (
                        <TooltipWrap key={cls} text={`${count} replies classified as "${cls}"`}>
                          <div style={{ padding: '14px 20px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', minWidth: '100px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ fontSize: '22px', fontWeight: 700, background: GRADIENT_PRIMARY, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{count}</div>
                            <div style={{ fontSize: '12px', color: TXT_MUTED, textTransform: 'capitalize', marginTop: '2px' }}>{cls}</div>
                          </div>
                        </TooltipWrap>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export */}
                <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <SectionHeader title="Export Data" subtitle="Download campaign data as CSV for offline analysis or reporting." />
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <TooltipWrap text="Downloads all leads in this campaign as a CSV file">
                      <button onClick={() => handleExportCsv('leads')} disabled={isExporting === 'leads'}
                        style={{ ...btnBase, background: GRADIENT_SUCCESS, color: '#1a1a2e', fontSize: '13px', opacity: isExporting === 'leads' ? 0.5 : 1 }}>
                        {isExporting === 'leads' ? 'Exporting...' : 'Export Leads CSV'}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Downloads all outreach attempts with statuses as CSV">
                      <button onClick={() => handleExportCsv('attempts')} disabled={isExporting === 'attempts'}
                        style={{ ...btnBase, background: GRADIENT_PRIMARY, color: '#fff', fontSize: '13px', opacity: isExporting === 'attempts' ? 0.5 : 1 }}>
                        {isExporting === 'attempts' ? 'Exporting...' : 'Export Attempts CSV'}
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Downloads all received replies with classifications as CSV">
                      <button onClick={() => handleExportCsv('replies')} disabled={isExporting === 'replies'}
                        style={{ ...btnBase, background: GRADIENT_WARNING, color: '#1a1a2e', fontSize: '13px', opacity: isExporting === 'replies' ? 0.5 : 1 }}>
                        {isExporting === 'replies' ? 'Exporting...' : 'Export Replies CSV'}
                      </button>
                    </TooltipWrap>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: TXT_FAINT, textAlign: 'center', padding: '40px 0' }}>
                Select a campaign from the <strong>Campaigns</strong> tab to view analytics.
              </p>
            )}
          </div>
        )}
      </div>

      <AiProspectModal
        isOpen={isAiProspecting}
        currentStep={aiProgressStep}
        progressLabel={aiProgressLabel}
        totalOpportunities={discoveredOpportunities.length}
        onClose={() => {}}
      />
    </div>
  );
};

export default BacklinkOutreachDashboard;
