import React, { useCallback, useEffect, useState } from 'react';
import { SafeResponsiveContainer } from '../shared/SafeResponsiveContainer';
import { useAuth } from '@clerk/clerk-react';
import { useBacklinkOutreachStore } from '../../stores/backlinkOutreachStore';
import {
  listEmailTemplates,
  generateEmailTemplate,
  generateSubjectLines,
  generateFollowUp,
  personalizeEmail,
  createEmailTemplate,
  EmailTemplateRecord,
  GenerateEmailRequest,
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
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

type Tab = 'campaigns' | 'discover' | 'leads' | 'composer' | 'analytics';

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
    isLoading, isDiscovering, error,
    fetchCampaigns, createCampaign, selectCampaign,
    deepDiscover, clearDiscoveries,
    attempts, replies, followups, analytics,
    fetchAttempts, fetchReplies, fetchFollowUps, fetchAnalytics,
  } = useBacklinkOutreachStore();

  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [discoverCampaignId, setDiscoverCampaignId] = useState('');

  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [topic, setTopic] = useState('');
  const [targetSite, setTargetSite] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'casual' | 'formal'>('professional');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderOrganization, setSenderOrganization] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [unsubscribeUrl, setUnsubscribeUrl] = useState('');
  const [oneClickUnsubscribe, setOneClickUnsubscribe] = useState(false);
  const [legalBasis, setLegalBasis] = useState('legitimate_interest');
  const [contactDiscoverySource, setContactDiscoverySource] = useState('');
  const [recipientRegion, setRecipientRegion] = useState('unknown');
  const [recipientRegionSource, setRecipientRegionSource] = useState('user_attested');
  const [consentStatus, setConsentStatus] = useState('unknown');
  const [approvedByHuman, setApprovedByHuman] = useState(false);

  const [leadName, setLeadName] = useState('');
  const [leadSite, setLeadSite] = useState('');
  const [leadContentTopic, setLeadContentTopic] = useState('');

  const [followUpDays, setFollowUpDays] = useState(7);
  const [replyContext, setReplyContext] = useState('');

  const [templateName, setTemplateName] = useState('');

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'discovered' | 'contacted' | 'replied' | 'placed' | 'bounced' | 'unsubscribed'>('contacted');

  const [volumeData, setVolumeData] = useState<CampaignVolumePoint[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns(workspaceId);
  }, [fetchCampaigns, workspaceId]);

  useEffect(() => {
    listEmailTemplates().then(r => setTemplates(r.templates)).catch(() => showToastNotification('Failed to load email templates', 'error'));
  }, []);

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

  const handleCreateCampaign = useCallback(async () => {
    if (!newCampaignName.trim()) return;
    const id = await createCampaign(workspaceId, newCampaignName.trim());
    if (id) {
      setNewCampaignName('');
      setActiveTab('discover');
    }
  }, [newCampaignName, createCampaign]);

  const handleDiscover = useCallback(async () => {
    if (!keyword.trim()) return;
    await deepDiscover(keyword.trim(), 15);
  }, [keyword, deepDiscover]);

  const handleDiscoverAndSave = useCallback(async () => {
    if (!keyword.trim() || !discoverCampaignId || discoveredOpportunities.length === 0) return;
    for (const opp of discoveredOpportunities) {
      try {
        await addLeadToCampaign(discoverCampaignId, {
          campaign_id: discoverCampaignId,
          url: opp.url,
          domain: opp.domain,
          page_title: opp.page_title,
          snippet: opp.snippet,
          email: opp.email ?? undefined,
          confidence_score: opp.confidence_score,
        });
      } catch (e) {
        // skip duplicates
      }
    }
    showToastNotification(`Saved ${discoveredOpportunities.length} leads to campaign`, 'success');
  }, [keyword, discoverCampaignId, discoveredOpportunities]);

  const handleSelectCampaign = useCallback(async (campaignId: string) => {
    await selectCampaign(campaignId);
    setActiveTab('leads');
  }, [selectCampaign]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    try {
      const payload: GenerateEmailRequest = {
        topic: topic.trim(),
        target_site: targetSite.trim() || undefined,
        tone,
        existing_template_id: selectedTemplateId || undefined,
      };
      const result = await generateEmailTemplate(payload);
      setSubject(result.subject);
      setBody(result.body);
      setSubjectSuggestions([]);
    } catch (e) {
      showToastNotification('Email generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, targetSite, tone, selectedTemplateId]);

  const handleSuggestSubjects = useCallback(async () => {
    if (!body.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateSubjectLines({ body: body.trim() });
      setSubjectSuggestions(result.subjects);
    } catch (e) {
      showToastNotification('Failed to generate subject lines', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [body]);

  const handlePersonalize = useCallback(async () => {
    if (!leadName.trim() || !leadSite.trim() || !leadContentTopic.trim() || !topic.trim()) return;
    setIsGenerating(true);
    try {
      const result = await personalizeEmail({
        lead_name: leadName.trim(),
        lead_site: leadSite.trim(),
        lead_content_topic: leadContentTopic.trim(),
        pitch_topic: topic.trim(),
        existing_body: body,
      });
      setSubject(result.subject);
      setBody(result.body);
    } catch (e) {
      showToastNotification('Personalization failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [leadName, leadSite, leadContentTopic, topic, body]);

  const handleFollowUp = useCallback(async () => {
    if (!subject.trim() || !body.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateFollowUp({
        original_subject: subject.trim(),
        original_body: body.trim(),
        days_elapsed: followUpDays,
        reply_context: replyContext.trim() || undefined,
      });
      setSubject(result.subject);
      setBody(result.body);
    } catch (e) {
      showToastNotification('Follow-up generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [subject, body, followUpDays, replyContext]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !subject.trim() || !body.trim()) return;
    try {
      await createEmailTemplate({
        name: templateName.trim(),
        subject_template: subject,
        body_template: body,
        variables: ['lead_name', 'lead_site', 'pitch_topic'],
      });
      setTemplateName('');
      const updated = await listEmailTemplates();
      setTemplates(updated.templates);
    } catch (e) {
      showToastNotification('Failed to save template', 'error');
    }
  }, [templateName, subject, body]);

  const applySuggestion = (s: string) => {
    setSubject(s);
    setSubjectSuggestions([]);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleAllLeads = () => {
    if (!selectedCampaign) return;
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
    { key: 'discover', label: 'Discover', desc: 'AI-powered search for guest post opportunities' },
    { key: 'leads', label: 'Leads', desc: 'Track leads, send outreach, and manage replies' },
    { key: 'composer', label: 'Composer', desc: 'AI email composer with compliance metadata' },
    { key: 'analytics', label: 'Analytics', desc: 'Campaign performance metrics and exports' },
  ];


  const complianceReasons = [
    !unsubscribeUrl.trim() && !oneClickUnsubscribe ? 'Add an unsubscribe URL or enable one-click unsubscribe.' : '',
    !senderName.trim() ? 'Add the sender name.' : '',
    !senderEmail.trim() ? 'Add the sender email.' : '',
    !senderOrganization.trim() ? 'Add the sender organization.' : '',
    !senderAddress.trim() ? 'Add a physical mailing address.' : '',
    !legalBasis.trim() ? 'Record the legal basis.' : '',
    !contactDiscoverySource.trim() ? 'Record where the contact was discovered.' : '',
    recipientRegion === 'unknown' && !approvedByHuman ? 'Unknown recipient region requires manual review.' : '',
    recipientRegionSource === 'tld_inference' && !approvedByHuman ? 'TLD-only region inference requires manual review.' : '',
    ['eu', 'eea', 'uk', 'ca'].includes(recipientRegion) && (legalBasis !== 'consent' || consentStatus !== 'explicit')
      ? 'Selected recipient region requires recorded explicit consent.' : '',
  ].filter(Boolean);

  const complianceReady = complianceReasons.length === 0;

  const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ margin: 0, background: GRADIENT_PRIMARY, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '18px' }}>{title}</h3>
      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>
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
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
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
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>
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
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    Status: {c.status} {c.created_at && <> &middot; Created {new Date(c.created_at).toLocaleDateString()}</>}
                  </div>
                </div>
              </TooltipWrap>
            ))}
            {isLoading && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</p>}
          </div>
        )}

        {/* === DISCOVER TAB === */}
        {activeTab === 'discover' && (
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
            {isDiscovering && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                Searching across Exa (neural) + DuckDuckGo... This may take 10–20 seconds.
              </p>
            )}
            {discoveredOpportunities.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{discoveredOpportunities.length} opportunities found</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <TooltipWrap text="Save discovered leads directly to a campaign for tracking">
                      <select value={discoverCampaignId} onChange={(e) => setDiscoverCampaignId(e.target.value)}
                        style={{ ...selectSx, padding: '8px 12px', fontSize: '13px', minWidth: '160px' }}>
                        <option value="">-- Select campaign --</option>
                        {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
                      </select>
                    </TooltipWrap>
                    <TooltipWrap text="Saves all discovered leads to your selected campaign">
                      <button onClick={handleDiscoverAndSave}
                        disabled={!keyword.trim() || !discoverCampaignId}
                        style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: GRADIENT_PRIMARY, color: '#fff', opacity: discoverCampaignId ? 1 : 0.4 }}>
                        Save to Campaign
                      </button>
                    </TooltipWrap>
                    <TooltipWrap text="Clears current search results">
                      <button onClick={clearDiscoveries}
                        style={{ ...btnBase, padding: '8px 16px', fontSize: '13px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                        Clear
                      </button>
                    </TooltipWrap>
                  </div>
                </div>
                {discoveredOpportunities.map((opp, i) => (
                  <div key={`${opp.url}-${i}`} style={{
                    padding: '16px', marginBottom: '8px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      <a href={opp.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#8b9cf7', textDecoration: 'none' }}>
                        {opp.page_title || opp.domain}
                      </a>
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{opp.domain}</div>
                    {opp.snippet && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>{opp.snippet.slice(0, 200)}...</div>}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
                      <TooltipWrap text="How relevant this site is to your keyword based on content analysis">
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Quality: <strong style={{ color: '#43e97b' }}>{(opp.quality_score * 100).toFixed(0)}%</strong></span>
                      </TooltipWrap>
                      <TooltipWrap text="Confidence that this site accepts guest posts, based on page signals">
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Confidence: <strong style={{ color: '#8b9cf7' }}>{(opp.confidence_score * 100).toFixed(0)}%</strong></span>
                      </TooltipWrap>
                      {opp.has_guest_post_guidelines && (
                        <TooltipWrap text="This site has a dedicated guest post guidelines page">
                          <span style={{ color: '#43e97b' }}>Has guidelines</span>
                        </TooltipWrap>
                      )}
                      {opp.email && (
                        <TooltipWrap text="Contact email found on the site">
                          <span style={{ color: '#8b9cf7' }}>Email found</span>
                        </TooltipWrap>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isDiscovering && discoveredOpportunities.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
                Enter a keyword above and click Discover to find guest post opportunities.
              </p>
            )}
          </div>
        )}

        {/* === LEADS TAB === */}
        {activeTab === 'leads' && (
          <div style={{ ...cardSx, padding: '24px' }}>
            {selectedCampaign ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff' }}>{selectedCampaign.name}</h3>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
                      {selectedCampaign.lead_count} leads &middot; Status: {selectedCampaign.status}
                    </p>
                  </div>
                  <TooltipWrap text="Switch to a different campaign">
                    <select onChange={(e) => { const c = campaigns.find(x => x.campaign_id === e.target.value); if (c) handleSelectCampaign(c.campaign_id); }}
                      value={selectedCampaign.campaign_id} style={{ ...selectSx, padding: '8px 12px', fontSize: '13px', minWidth: '180px' }}>
                      {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
                    </select>
                  </TooltipWrap>
                </div>

                {/* Analytics cards */}
                {analytics && (
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {[{ label: 'Sent', value: analytics.send_volume, grad: GRADIENT_PRIMARY },
                      { label: 'Response Rate', value: `${(analytics.response_rate * 100).toFixed(1)}%`, grad: GRADIENT_SUCCESS },
                      { label: 'Replies', value: analytics.reply_count, grad: GRADIENT_WARNING },
                      { label: 'Placement', value: `${(analytics.placement_rate * 100).toFixed(1)}%`, grad: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
                      { label: 'Blocked', value: analytics.blocked_count, grad: GRADIENT_SECONDARY },
                    ].map(({ label, value, grad }) => (
                      <TooltipWrap key={label} text={`${label}: ${value}`}>
                        <div style={{
                          flex: 1, minWidth: '100px', padding: '14px', borderRadius: '10px', textAlign: 'center',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <div style={{ fontSize: '22px', fontWeight: 700, background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{value}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                        </div>
                      </TooltipWrap>
                    ))}
                  </div>
                )}

                {/* Reply classification */}
                {analytics && Object.keys(analytics.reply_classification).length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Reply Classification</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {Object.entries(analytics.reply_classification).map(([cls, count]) => (
                        <TooltipWrap key={cls} text={`${count} replies classified as "${cls}"`}>
                          <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                            <strong>{cls}</strong>: {count}
                          </span>
                        </TooltipWrap>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bulk actions */}
                {selectedCampaign.leads.length > 0 && (
                  <div style={{
                    display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px',
                    padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', flexWrap: 'wrap',
                  }}>
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
                      <input type="checkbox" checked={selectedLeadIds.size === selectedCampaign.leads.length && selectedCampaign.leads.length > 0}
                        onChange={toggleAllLeads} style={{ accentColor: '#667eea' }} />
                      {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} selected` : 'Select all'}
                    </label>
                    {selectedLeadIds.size > 0 && (
                      <>
                        <TooltipWrap text="Choose the new status for all selected leads">
                          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
                            style={{ ...selectSx, padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}>
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </TooltipWrap>
                        <TooltipWrap text="Updates the status of all selected leads in one click">
                          <button onClick={handleBulkStatusUpdate} disabled={isStatusUpdating}
                            style={{ ...btnBase, padding: '6px 16px', fontSize: '12px', background: GRADIENT_PRIMARY, color: '#fff', opacity: isStatusUpdating ? 0.5 : 1 }}>
                            {isStatusUpdating ? 'Updating...' : 'Update Status'}
                          </button>
                        </TooltipWrap>
                      </>
                    )}
                  </div>
                )}

                {selectedCampaign.leads.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>
                    No leads yet. Go to the <strong>Discover</strong> tab to find and save opportunities.
                  </p>
                )}

                {/* Lead cards */}
                {selectedCampaign.leads.map((lead) => (
                  <div key={lead.lead_id} style={{
                    padding: '16px', marginBottom: '8px', borderRadius: '10px',
                    background: selectedLeadIds.has(lead.lead_id) ? 'rgba(102,126,234,0.1)' : 'rgba(255,255,255,0.03)',
                    border: selectedLeadIds.has(lead.lead_id) ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input type="checkbox" checked={selectedLeadIds.has(lead.lead_id)}
                        onChange={() => toggleLeadSelection(lead.lead_id)} style={{ marginTop: '4px', accentColor: '#667eea' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{lead.page_title || lead.domain}</div>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                          {lead.url && <a href={lead.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b9cf7' }}>{lead.url}</a>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', alignItems: 'center', flexWrap: 'wrap' }}>
                          {renderStatusBadge(lead.status)}
                          {lead.email && <span>Email: {lead.email}</span>}
                          <span>Source: {lead.discovery_source}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {STATUS_OPTIONS.map((s) => (
                            <TooltipWrap key={s} text={STATUS_EXPLANATIONS[s] || ''}>
                              <button onClick={() => handleSingleStatusUpdate(lead.lead_id, s)}
                                disabled={lead.status === s || isStatusUpdating}
                                style={{
                                  padding: '4px 12px', fontSize: '11px', borderRadius: '20px', border: '1px solid',
                                  borderColor: lead.status === s ? '#667eea' : 'rgba(255,255,255,0.15)',
                                  background: lead.status === s ? GRADIENT_PRIMARY : 'transparent',
                                  color: lead.status === s ? '#fff' : 'rgba(255,255,255,0.5)',
                                  cursor: lead.status === s ? 'default' : 'pointer', fontWeight: lead.status === s ? 600 : 400,
                                  transition: 'all 0.2s',
                                }}>
                                {s}
                              </button>
                            </TooltipWrap>
                          ))}
                        </div>
                        {attempts.filter(a => a.lead_id === lead.lead_id).slice(0, 1).map(a => (
                          <div key={a.attempt_id} style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '12px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Latest: {a.subject} — </span>
                            {renderStatusBadge(a.status)}
                            {a.sender_email && <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: '8px' }}>From: {a.sender_email}</span>}
                            {a.sent_at && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>{new Date(a.sent_at).toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Attempt history */}
                {attempts.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <SectionHeader title="Attempt History" subtitle="Record of all outreach emails sent and their delivery statuses." />
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                            {['Subject', 'Status', 'Effective Sender', 'Sent At'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {attempts.map((a) => (
                            <tr key={a.attempt_id}>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#fff', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.subject}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{renderStatusBadge(a.status)}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{a.sender_email}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{a.sent_at ? new Date(a.sent_at).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Reply inbox */}
                {replies.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <SectionHeader title="Reply Inbox" subtitle={`${replies.length} replies received. Each reply is auto-classified by sentiment for quick triage.`} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {replies.map((r) => (
                        <div key={r.reply_id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>{r.subject}</span>
                            <TooltipWrap text={`Auto-classified as "${r.classification}"`}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                background: r.classification === 'positive' ? 'rgba(67,233,123,0.15)' : r.classification === 'negative' ? 'rgba(245,87,108,0.15)' : 'rgba(254,225,64,0.1)',
                                color: r.classification === 'positive' ? '#43e97b' : r.classification === 'negative' ? '#f5576c' : '#fee140',
                                border: `1px solid ${r.classification === 'positive' ? '#43e97b33' : r.classification === 'negative' ? '#f5576c33' : '#fee14033'}`,
                              }}>
                                {r.classification}
                              </span>
                            </TooltipWrap>
                          </div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>From: {r.from_email} &middot; {r.received_at ? new Date(r.received_at).toLocaleString() : ''}</div>
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}>{r.body.slice(0, 300)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up schedule */}
                {followups.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <SectionHeader title="Follow-up Schedule" subtitle="Automated follow-up emails scheduled to re-engage leads who haven't replied." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {followups.map((f) => (
                        <div key={f.schedule_id} style={{
                          padding: '12px 16px', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                          fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ color: '#fff' }}>{f.subject}</span>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {f.scheduled_for && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{new Date(f.scheduled_for).toLocaleDateString()}</span>}
                            <TooltipWrap text={f.sent ? 'This follow-up has been sent' : 'Awaiting scheduled send date'}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                background: f.sent ? 'rgba(67,233,123,0.15)' : 'rgba(254,225,64,0.1)',
                                color: f.sent ? '#43e97b' : '#fee140',
                                border: `1px solid ${f.sent ? '#43e97b33' : '#fee14033'}`,
                              }}>
                                {f.sent ? 'Sent' : 'Pending'}
                              </span>
                            </TooltipWrap>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>
                Select a campaign from the <strong>Campaigns</strong> tab to view its leads.
              </p>
            )}
          </div>
        )}

        {/* === COMPOSER TAB === */}
        {activeTab === 'composer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ ...cardSx, padding: '24px' }}>
              <SectionHeader title="AI Email Composer" subtitle="Generate personalized outreach emails with AI. Choose a tone, pick a template, and let AI craft your message." />

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Template</label>
                <TooltipWrap text="Optional: start from an existing saved template to maintain consistent branding">
                  <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={selectSx}>
                    <option value="">-- No template (start fresh) --</option>
                    {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                  </select>
                </TooltipWrap>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Topic / Keyword</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. AI marketing trends, SaaS growth strategies"
                  style={inputSx} />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Target Site (optional)</label>
                <TooltipWrap text="Mentioning the target site helps AI tailor the pitch to that specific publication">
                  <input type="text" value={targetSite} onChange={(e) => setTargetSite(e.target.value)}
                    placeholder="e.g. example.com"
                    style={inputSx} />
                </TooltipWrap>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Tone</label>
                <TooltipWrap text="Controls the writing style — Professional (formal), Friendly (conversational), Casual (relaxed), or Formal (highly polished)">
                  <select value={tone} onChange={(e) => setTone(e.target.value as any)} style={selectSx}>
                    <option value="professional">Professional — Formal & polished</option>
                    <option value="friendly">Friendly — Warm & conversational</option>
                    <option value="casual">Casual — Relaxed & informal</option>
                    <option value="formal">Formal — Highly structured & official</option>
                  </select>
                </TooltipWrap>
              </div>

              <TooltipWrap text="Generates a complete outreach email with subject + body using AI">
                <button onClick={handleGenerate} disabled={!topic.trim() || isGenerating}
                  style={{ ...btnBase, width: '100%', padding: '14px', background: GRADIENT_PRIMARY, color: '#fff', marginBottom: '20px', opacity: !topic.trim() || isGenerating ? 0.5 : 1 }}>
                  {isGenerating ? 'Generating with AI...' : 'Generate with AI'}
                </button>
              </TooltipWrap>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>Subject Line</label>
                  <TooltipWrap text="AI suggests multiple subject line variants based on your email body">
                    <button onClick={handleSuggestSubjects} disabled={!body.trim() || isGenerating}
                      style={{ ...btnBase, padding: '6px 14px', fontSize: '12px', background: 'rgba(102,126,234,0.2)', color: '#8b9cf7', border: '1px solid rgba(102,126,234,0.3)' }}>
                      Suggest
                    </button>
                  </TooltipWrap>
                </div>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" style={inputSx} />
                {subjectSuggestions.length > 0 && (
                  <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Click a suggestion to apply</div>
                    {subjectSuggestions.map((s, i) => (
                      <div key={i} onClick={() => applySuggestion(s)}
                        style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: '#8b9cf7', transition: 'background 0.2s' }}>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Email Body</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                  placeholder="Your email content — or let AI generate it above"
                  style={{ ...inputSx, fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {/* Compliance metadata */}
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: complianceReady ? 'rgba(67,233,123,0.08)' : 'rgba(245,87,108,0.08)', border: `1px solid ${complianceReady ? 'rgba(67,233,123,0.22)' : 'rgba(245,87,108,0.22)'}` }}>
                <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '14px' }}>Send Compliance Metadata</h4>
                <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>Policy checks require unsubscribe, sender identity, legal basis, contact source, and region-aware consent/review details before a send can be approved.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Sender name" style={inputSx} />
                  <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="Sender email" style={inputSx} />
                  <input type="text" value={senderOrganization} onChange={(e) => setSenderOrganization(e.target.value)} placeholder="Organization / brand" style={inputSx} />
                  <input type="text" value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Physical mailing address" style={inputSx} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input type="url" value={unsubscribeUrl} onChange={(e) => setUnsubscribeUrl(e.target.value)} placeholder="Unsubscribe URL" style={inputSx} />
                  <label style={{ ...inputSx, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={oneClickUnsubscribe} onChange={(e) => setOneClickUnsubscribe(e.target.checked)} />
                    One-click unsubscribe available
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <select value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} style={selectSx}>
                    <option value="legitimate_interest">Legitimate interest</option>
                    <option value="consent">Consent</option>
                    <option value="contract">Contract</option>
                  </select>
                  <input type="text" value={contactDiscoverySource} onChange={(e) => setContactDiscoverySource(e.target.value)} placeholder="Contact discovery source (e.g. contact page URL)" style={inputSx} />
                  <select value={recipientRegion} onChange={(e) => setRecipientRegion(e.target.value)} style={selectSx}>
                    <option value="unknown">Recipient region unknown</option>
                    <option value="us">United States</option>
                    <option value="eu">EU / EEA</option>
                    <option value="uk">United Kingdom</option>
                    <option value="ca">Canada</option>
                    <option value="au">Australia</option>
                    <option value="br">Brazil</option>
                    <option value="other">Other</option>
                  </select>
                  <select value={recipientRegionSource} onChange={(e) => setRecipientRegionSource(e.target.value)} style={selectSx}>
                    <option value="user_attested">Region user-attested</option>
                    <option value="crm_record">Region from CRM/contact record</option>
                    <option value="billing_or_profile">Region from profile/billing data</option>
                    <option value="tld_inference">Region inferred from TLD only</option>
                    <option value="unknown">Region source unknown</option>
                  </select>
                  <select value={consentStatus} onChange={(e) => setConsentStatus(e.target.value)} style={selectSx}>
                    <option value="unknown">Consent status unknown</option>
                    <option value="explicit">Explicit consent recorded</option>
                    <option value="implied">Implied consent / soft opt-in</option>
                    <option value="not_required">Not required for selected basis</option>
                  </select>
                  <label style={{ ...inputSx, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={approvedByHuman} onChange={(e) => setApprovedByHuman(e.target.checked)} />
                    Manual review approved
                  </label>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: '8px', background: complianceReady ? 'rgba(67,233,123,0.12)' : 'rgba(245,87,108,0.12)', color: complianceReady ? '#43e97b' : '#f5576c', fontSize: '12px' }}>
                  {complianceReady ? 'Compliance metadata is complete for policy validation.' : (
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {complianceReasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              {/* Personalize */}
              <div style={{ marginTop: '24px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '14px' }}>Personalize for Lead</h4>
                <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Tailor the email to a specific lead by filling in their details.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Lead name" style={inputSx} />
                  <input type="text" value={leadSite} onChange={(e) => setLeadSite(e.target.value)} placeholder="Their site" style={inputSx} />
                </div>
                <input type="text" value={leadContentTopic} onChange={(e) => setLeadContentTopic(e.target.value)}
                  placeholder="Topic of their relevant content"
                  style={{ ...inputSx, marginBottom: '10px' }} />
                <TooltipWrap text="Rewrites your email to reference the specific lead's name, site, and content">
                  <button onClick={handlePersonalize} disabled={!leadName.trim() || !leadSite.trim() || !leadContentTopic.trim() || isGenerating}
                    style={{ ...btnBase, width: '100%', padding: '10px', background: GRADIENT_WARNING, color: '#1a1a2e', opacity: leadName.trim() && leadSite.trim() && leadContentTopic.trim() && !isGenerating ? 1 : 0.5 }}>
                    Personalize Email
                  </button>
                </TooltipWrap>
              </div>

              {/* Follow-up */}
              <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '14px' }}>Draft Follow-up</h4>
                <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Generate a polite follow-up email to re-engage a lead who hasn't responded.</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="number" value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))} min={1} max={90}
                    style={{ ...inputSx, width: '80px' }} />
                  <span style={{ padding: '10px 0', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>days since original email</span>
                </div>
                <input type="text" value={replyContext} onChange={(e) => setReplyContext(e.target.value)}
                  placeholder="Their reply (if any) — leave blank for no-response follow-up"
                  style={{ ...inputSx, marginBottom: '10px' }} />
                <TooltipWrap text="Creates a follow-up email that references the original and any reply context">
                  <button onClick={handleFollowUp} disabled={!subject.trim() || !body.trim() || isGenerating}
                    style={{ ...btnBase, width: '100%', padding: '10px', background: GRADIENT_SECONDARY, color: '#fff', opacity: subject.trim() && body.trim() && !isGenerating ? 1 : 0.5 }}>
                    Generate Follow-up
                  </button>
                </TooltipWrap>
              </div>

              {/* Save template */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. 'Cold outreach v1')"
                  style={{ ...inputSx, flex: 1 }} />
                <TooltipWrap text="Saves the current subject + body as a reusable template">
                  <button onClick={handleSaveTemplate} disabled={!templateName.trim() || !subject.trim() || !body.trim()}
                    style={{ ...btnBase, background: GRADIENT_SUCCESS, color: '#1a1a2e', opacity: templateName.trim() && subject.trim() && body.trim() ? 1 : 0.5 }}>
                    Save as Template
                  </button>
                </TooltipWrap>
              </div>

              {selectedCampaign && subject.trim() && body.trim() && (
                <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: complianceReady ? 'rgba(67,233,123,0.1)' : 'rgba(245,87,108,0.1)', border: `1px solid ${complianceReady ? 'rgba(67,233,123,0.2)' : 'rgba(245,87,108,0.2)'}` }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: complianceReady ? '#43e97b' : '#f5576c' }}>
                    {complianceReady ? <>Ready to send this email to leads in <strong>{selectedCampaign.name}</strong>.</> : <>Complete compliance metadata before sending to <strong>{selectedCampaign.name}</strong> leads.</>}
                  </p>
                  <TooltipWrap text={complianceReady ? 'Go to the Leads tab to select recipients and send' : 'Policy validation will block sends until all listed compliance fields are complete'}>
                    <button onClick={() => setActiveTab('leads')} disabled={!complianceReady}
                      style={{ ...btnBase, padding: '8px 20px', background: GRADIENT_SUCCESS, color: '#1a1a2e', fontSize: '13px', opacity: complianceReady ? 1 : 0.5 }}>
                      Go to Campaign Leads
                    </button>
                  </TooltipWrap>
                </div>
              )}
            </div>

            {/* Preview pane */}
            <div style={{ ...cardSx, padding: '24px' }}>
              <SectionHeader title="Preview" subtitle="See how your email will look when received." />
              <div style={{ padding: '24px', minHeight: '400px', borderRadius: '8px', background: '#fff' }}>
                {subject || body ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '16px', padding: '0 0 12px', borderBottom: '2px solid #eee', color: '#333' }}>
                      {subject || '(no subject)'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: '#555' }}>
                      {body || '(no body)'}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                    <p>Generate an email to see a live preview here.</p>
                    <p style={{ fontSize: '12px', color: '#bbb' }}>Use the AI tools on the left to create your message.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === ANALYTICS TAB === */}
        {activeTab === 'analytics' && (
          <div style={{ ...cardSx, padding: '24px' }}>
            {selectedCampaign ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff' }}>{selectedCampaign.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Performance analytics & reporting</p>
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
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                        </div>
                      </TooltipWrap>
                    ))}
                  </div>
                )}

                {isAnalyticsLoading && <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px' }}>Loading analytics data...</p>}

                {/* Volume chart */}
                {volumeData.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Send Volume Trend" subtitle={`Daily outreach email send volume over the last ${analyticsDays} days.`} />
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <SafeResponsiveContainer width="100%" height={250}>
                        <LineChart data={volumeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <RechartsTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                          <Line type="monotone" dataKey="count" stroke="#667eea" strokeWidth={2} dot={{ r: 3, fill: '#667eea' }} />
                        </LineChart>
                      </SafeResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Funnel chart */}
                {funnelData.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Lead Conversion Funnel" subtitle="Breakdown of leads by status stage. Shows where leads are in the outreach pipeline." />
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <SafeResponsiveContainer width="100%" height={250}>
                        <BarChart data={funnelData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="status" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
                          <RechartsTooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                          <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </SafeResponsiveContainer>
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
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize', marginTop: '2px' }}>{cls}</div>
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
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>
                Select a campaign from the <strong>Campaigns</strong> tab to view analytics.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BacklinkOutreachDashboard;
