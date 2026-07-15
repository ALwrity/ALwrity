import React, { useCallback, useEffect, useState } from 'react';
import { useComposerPersistStore } from '../../stores/composerPersistStore';
import {
  listEmailTemplates,
  generateEmailTemplate,
  generateFollowUp,
  personalizeEmail,
  createEmailTemplate,
  EmailTemplateRecord,
  GenerateEmailRequest,
} from '../../api/backlinkOutreachApi';
import { showToastNotification } from '../../utils/toastNotifications';
import AdvancedSettings from './AdvancedSettings';
import EmailGenerationModal from './EmailGenerationModal';
import EmailPreview from './EmailPreview';

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #667eea, #764ba2)';
const GRADIENT_SECONDARY = 'linear-gradient(135deg, #f093fb, #f5576c)';
const GRADIENT_SUCCESS = 'linear-gradient(135deg, #43e97b, #38f9d7)';
const GRADIENT_WARNING = 'linear-gradient(135deg, #fa709a, #fee140)';

const GRADIENT_CARD = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))';

const TXT_HEADING = '#fff';
const TXT_BODY = 'rgba(255,255,255,0.88)';
const TXT_MUTED = 'rgba(255,255,255,0.6)';
const TXT_FAINT = 'rgba(255,255,255,0.42)';

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
  background: '#1e1e3a',
};
const optionSx: React.CSSProperties = { color: '#1a1a2e', background: '#fff' };

const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  fontSize: '14px', padding: '10px 24px', transition: 'all 0.2s',
};

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

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div style={{ marginBottom: '16px' }}>
    <h3 style={{ margin: 0, background: GRADIENT_PRIMARY, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '18px' }}>{title}</h3>
    <p style={{ margin: '4px 0 0', fontSize: '13px', color: TXT_MUTED }}>{subtitle}</p>
  </div>
);

import { ComposerState } from './useComposerState';

interface ComposerTabProps {
  composer: ComposerState;
  keyword: string;
  suppressedList: any[];
  selectedCampaign: any;
  onFetchSuppressedList: () => void;
  onAddSuppressedRecipient: (email: string, reason: string) => void;
  onRemoveSuppressedRecipient: (id: string) => void;
  onGoToLeads: () => void;
}

const ComposerTab: React.FC<ComposerTabProps> = ({
  composer,
  keyword,
  suppressedList, selectedCampaign,
  onFetchSuppressedList, onAddSuppressedRecipient, onRemoveSuppressedRecipient,
  onGoToLeads,
}) => {
  const {
    subject, setSubject, body, setBody, senderEmail, setSenderEmail,
    unsubscribeUrl, setUnsubscribeUrl, oneClickUnsubscribe, setOneClickUnsubscribe,
    legalBasis, setLegalBasis, contactDiscoverySource, setContactDiscoverySource,
    recipientRegion, setRecipientRegion, recipientRegionSource, setRecipientRegionSource,
    consentStatus, setConsentStatus, approvedByHuman, setApprovedByHuman,
    sendingLeadId, handleSendToLead,
  } = composer;
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const selectedTemplateId = useComposerPersistStore((s) => s.selectedTemplateId);
  const setSelectedTemplateId = useComposerPersistStore((s) => s.setSelectedTemplateId);
  const topic = useComposerPersistStore((s) => s.topic);
  const setTopic = useComposerPersistStore((s) => s.setTopic);
  const targetSite = useComposerPersistStore((s) => s.targetSite);
  const setTargetSite = useComposerPersistStore((s) => s.setTargetSite);
  const tone = useComposerPersistStore((s) => s.tone);
  const setTone = useComposerPersistStore((s) => s.setTone);
  const [isGenerating, setIsGenerating] = useState(false);
  const [complianceReady, setComplianceReady] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genMode, setGenMode] = useState<'personalize' | 'generate' | 'followup' | 'subjects'>('generate');
  const [genError, setGenError] = useState<string | null>(null);

  const closeGenModal = useCallback(() => {
    setGenModalOpen(false);
    setGenError(null);
  }, []);

  const [leadName, setLeadName] = useState('');
  const [leadSite, setLeadSite] = useState('');
  const [leadContentTopic, setLeadContentTopic] = useState('');

  const followUpDays = useComposerPersistStore((s) => s.followUpDays);
  const setFollowUpDays = useComposerPersistStore((s) => s.setFollowUpDays);
  const replyContext = useComposerPersistStore((s) => s.replyContext);
  const setReplyContext = useComposerPersistStore((s) => s.setReplyContext);

  const [templateName, setTemplateName] = useState('');

  const [suppressionEmail, setSuppressionEmail] = useState('');
  const [suppressionReason, setSuppressionReason] = useState('');
  const [showSuppressionList, setShowSuppressionList] = useState(false);
  const [advanceToLeadId, setAdvanceToLeadId] = useState<string | null>(null);
  const selectedLeadId = useComposerPersistStore((s) => s.selectedLeadId);
  const setSelectedLeadId = useComposerPersistStore((s) => s.setSelectedLeadId);
  const leads = (selectedCampaign?.leads || []) as any[];
  const leadsWithEmail = leads.filter((l: any) => l.email);

  useEffect(() => {
    const fallback = keyword || selectedCampaign?.name || '';
    if (fallback && !topic) {
      setTopic(fallback);
    }
  }, [keyword, selectedCampaign?.name]);

  useEffect(() => {
    if (!selectedLeadId || !leads.length) return;
    const lead = leads.find((l: any) => l.lead_id === selectedLeadId);
    if (!lead) return;
    setLeadName(lead.ai_editor_name || lead.exa_author || lead.page_title || lead.domain || '');
    setLeadSite(lead.domain || '');
    setTargetSite(lead.domain || '');
    setLeadContentTopic(lead.exa_summary || (lead.snippet ? lead.snippet.slice(0, 120) : '') || keyword || '');
    setContactDiscoverySource(lead.discovery_source || 'page_text');
    if (!topic.trim() && keyword) setTopic(keyword);
  }, [selectedLeadId]);

  useEffect(() => {
    setSelectedLeadId('');
  }, [selectedCampaign?.campaign_id]);

  useEffect(() => {
    listEmailTemplates().then(r => setTemplates(r.templates)).catch(() => showToastNotification('Failed to load email templates', 'error'));
  }, []);

  useEffect(() => {
    onFetchSuppressedList();
  }, [onFetchSuppressedList]);

  useEffect(() => {
    if (!isGenerating && genModalOpen) {
      const t = setTimeout(() => closeGenModal(), 1800);
      return () => clearTimeout(t);
    }
  }, [isGenerating, genModalOpen, closeGenModal]);

  useEffect(() => {
    if (advanceToLeadId && !sendingLeadId) {
      setSelectedLeadId(advanceToLeadId);
      setAdvanceToLeadId(null);
    }
  }, [sendingLeadId, advanceToLeadId]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setGenMode('generate');
    setGenError(null);
    setGenModalOpen(true);
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
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Email generation failed';
      setGenError(msg);
      showToastNotification(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, targetSite, tone, selectedTemplateId, setSubject, setBody]);

  const handlePersonalize = useCallback(async () => {
    if (!leadName.trim() || !leadSite.trim() || !leadContentTopic.trim() || !topic.trim()) return;
    setIsGenerating(true);
    setGenMode('personalize');
    setGenError(null);
    setGenModalOpen(true);
    try {
      const currentLead = leads.find((l: any) => l.lead_id === selectedLeadId);
      const highlights = currentLead && Array.isArray(currentLead.exa_highlights)
        ? currentLead.exa_highlights.join('. ') : (currentLead?.exa_highlights || undefined);
      const result = await personalizeEmail({
        lead_name: leadName.trim(),
        lead_site: leadSite.trim(),
        lead_content_topic: leadContentTopic.trim(),
        pitch_topic: topic.trim(),
        existing_body: body,
        tone,
        lead_summary: currentLead?.exa_summary || undefined,
        lead_highlights: highlights,
        lead_guidelines: currentLead?.ai_guidelines_summary || undefined,
        lead_pitch_angle: currentLead?.ai_pitch_angle || undefined,
        lead_published_date: currentLead?.exa_published_date || undefined,
      });
      setSubject(result.subject);
      setBody(result.body);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Personalization failed';
      setGenError(msg);
      showToastNotification(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [leadName, leadSite, leadContentTopic, topic, body, tone, setSubject, setBody, leads, selectedLeadId]);

  const handleGeneratePersonalized = useCallback(async () => {
    if (!selectedLeadId || !topic.trim()) return;
    const lead = leads.find((l: any) => l.lead_id === selectedLeadId);
    if (!lead) return;
    setIsGenerating(true);
    setGenMode('personalize');
    setGenError(null);
    setGenModalOpen(true);
    try {
      const nameVal = lead.ai_editor_name || lead.exa_author || lead.page_title || lead.domain || '';
      const contentVal = lead.exa_summary || (lead.snippet ? lead.snippet.slice(0, 120) : '') || topic;
      const highlights = Array.isArray(lead.exa_highlights) ? lead.exa_highlights.join('. ') : (lead.exa_highlights || undefined);
      const result = await personalizeEmail({
        lead_name: nameVal,
        lead_site: lead.domain || '',
        lead_content_topic: contentVal,
        pitch_topic: topic.trim(),
        existing_body: body || undefined,
        tone,
        lead_summary: lead.exa_summary || undefined,
        lead_highlights: highlights,
        lead_guidelines: lead.ai_guidelines_summary || undefined,
        lead_pitch_angle: lead.ai_pitch_angle || undefined,
        lead_published_date: lead.exa_published_date || undefined,
      });
      setSubject(result.subject);
      setBody(result.body);
      setLeadName(nameVal);
      setLeadSite(lead.domain || '');
      setLeadContentTopic(contentVal);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Personalized generation failed';
      setGenError(msg);
      showToastNotification(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedLeadId, leads, topic, body, tone, setSubject, setBody]);

  const handleFollowUp = useCallback(async () => {
    if (!subject.trim() || !body.trim()) return;
    setIsGenerating(true);
    setGenMode('followup');
    setGenError(null);
    setGenModalOpen(true);
    try {
      const result = await generateFollowUp({
        original_subject: subject.trim(),
        original_body: body.trim(),
        days_elapsed: followUpDays,
        reply_context: replyContext.trim() || undefined,
      });
      setSubject(result.subject);
      setBody(result.body);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Follow-up generation failed';
      setGenError(msg);
      showToastNotification(msg, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [subject, body, followUpDays, replyContext, setSubject, setBody]);

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30fr 70fr', gap: '24px' }}>
      <div style={{ ...cardSx, padding: '24px' }}>
        <SectionHeader title="AI Email Composer" subtitle="Generate personalized outreach emails with AI. Choose a tone, pick a template, and let AI craft your message." />

        {/* Campaign context */}
        {selectedCampaign && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
            background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
          }}>
            <div>
              <span style={{ fontSize: '12px', color: TXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Campaign</span>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>{selectedCampaign.name}</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span style={{ color: TXT_MUTED }}>Leads: <strong style={{ color: '#8b9cf7' }}>{leads.length}</strong></span>
              {leads.filter((l: any) => !!l.email).length > 0 && (
                <span style={{ color: TXT_MUTED }}>With email: <strong style={{ color: '#43e97b' }}>{leads.filter((l: any) => !!l.email).length}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Step workflow indicator */}
        {selectedCampaign && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {[
                { label: 'Select Lead', key: 0 },
                { label: 'Compose', key: 1 },
                { label: 'Personalize', key: 2 },
                { label: 'Send', key: 3 },
              ].map((step, i) => {
                const completed = i === 0 ? !!selectedLeadId : i === 1 ? !!(selectedLeadId && subject.trim() && body.trim()) : false;
                const active = !completed && (i === 0 ? !selectedLeadId : i === 1 ? !!(selectedLeadId && (!subject.trim() || !body.trim())) : i === 2 ? !!(selectedLeadId && subject.trim() && body.trim()) : false);
                return (
                  <React.Fragment key={step.key}>
                    {i > 0 && <div style={{ flex: 1, height: '2px', background: completed ? '#43e97b' : 'rgba(255,255,255,0.1)', margin: '0 8px' }} />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700,
                        background: completed ? '#43e97b' : active ? GRADIENT_PRIMARY : 'rgba(255,255,255,0.08)',
                        color: completed || active ? '#1a1a2e' : TXT_MUTED,
                        border: completed || active ? 'none' : '2px solid rgba(255,255,255,0.15)',
                        transition: 'all 0.3s',
                      }}>
                        {completed ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: '10px', color: completed ? '#43e97b' : active ? '#fff' : TXT_FAINT, whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>{step.label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            {!selectedLeadId && (
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: TXT_MUTED, textAlign: 'center' }}>
                Start by selecting a lead to compose a personalized email for.
              </p>
            )}
            {selectedLeadId && subject.trim() && body.trim() && !complianceReady && (
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#f5576c', textAlign: 'center' }}>
                Complete compliance metadata below to enable sending.
              </p>
            )}
            {leadsWithEmail.length > 0 && selectedLeadId && subject.trim() && body.trim() && (
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: TXT_MUTED, textAlign: 'center' }}>
                {leadsWithEmail.filter((l: any) => l.status !== 'contacted').length} of {leadsWithEmail.length} leads with email ready to contact
              </p>
            )}
          </div>
        )}

        {/* Enhanced lead selector */}
        {leads.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.2)' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: TXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Target Lead</label>
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)} style={selectSx}>
              <option value="" style={optionSx}>-- Select a lead to personalize for --</option>
              {leads.map((lead: any) => (
                <option key={lead.lead_id} value={lead.lead_id} style={optionSx}>
                  {lead.page_title || lead.domain}{lead.email ? ` — ${lead.email}` : ''}
                </option>
              ))}
            </select>
            {selectedLeadId && (() => {
              const lead = leads.find((l: any) => l.lead_id === selectedLeadId);
              if (!lead) return null;
              return (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.15)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{lead.page_title || 'Untitled Page'}</div>
                    <div style={{ fontSize: '12px', color: '#8b9cf7', marginBottom: '8px' }}>{lead.domain || lead.url || ''}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '12px', marginBottom: '8px' }}>
                      {lead.email && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(67,233,123,0.15)', color: '#43e97b', fontWeight: 600 }}>{lead.email}</span>}
                      {lead.status && <span style={{ padding: '2px 8px', borderRadius: '4px', background: lead.status === 'contacted' ? 'rgba(67,233,123,0.1)' : 'rgba(255,255,255,0.06)', color: lead.status === 'contacted' ? '#43e97b' : TXT_MUTED }}>{lead.status}</span>}
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: TXT_MUTED }}>Source: {lead.discovery_source || 'page_text'}</span>
                    </div>
                    {(lead.exa_summary || lead.ai_pitch_angle || lead.ai_guidelines_summary || lead.exa_published_date || lead.snippet) && (
                      <div style={{ fontSize: '12px', lineHeight: 1.5, marginTop: '8px' }}>
                        {lead.ai_editor_name && (
                          <div style={{ padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: 'rgba(102,126,234,0.1)' }}>
                            <span style={{ fontWeight: 600, color: '#8b9cf7' }}>Contact: </span>
                            <span style={{ color: '#fff' }}>{lead.ai_editor_name}</span>
                          </div>
                        )}
                        {lead.exa_summary && (
                          <div style={{ padding: '8px 10px', marginBottom: '4px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                            <span style={{ fontWeight: 600, color: TXT_FAINT, display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Article Summary</span>
                            <span style={{ color: TXT_BODY }}>{lead.exa_summary}</span>
                          </div>
                        )}
                        {lead.ai_pitch_angle && (
                          <div style={{ padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: 'rgba(67,233,123,0.08)' }}>
                            <span style={{ fontWeight: 600, color: '#43e97b', display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggested Pitch Angle</span>
                            <span style={{ color: TXT_BODY }}>{lead.ai_pitch_angle}</span>
                          </div>
                        )}
                        {lead.ai_guidelines_summary && (
                          <div style={{ padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                            <span style={{ fontWeight: 600, color: TXT_MUTED, display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Guest Post Guidelines</span>
                            <span style={{ color: TXT_BODY }}>{lead.ai_guidelines_summary}</span>
                          </div>
                        )}
                        {lead.exa_published_date && (
                          <div style={{ padding: '4px 10px', marginBottom: '4px' }}>
                            <span style={{ color: TXT_FAINT, fontSize: '11px' }}>Published: {lead.exa_published_date}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {subject.trim() && body.trim() && (
                    <button onClick={() => {
                      const lead = leads.find((l: any) => l.lead_id === selectedLeadId);
                      if (!lead) return;
                      const emailLeads = leads.filter((l: any) => l.email);
                      const currentIdx = emailLeads.findIndex((l: any) => l.lead_id === selectedLeadId);
                      const nextLead = currentIdx >= 0 && currentIdx < emailLeads.length - 1 ? emailLeads[currentIdx + 1] : null;
                      if (nextLead) setAdvanceToLeadId(nextLead.lead_id);
                      handleSendToLead(lead, selectedCampaign);
                    }} disabled={sendingLeadId === (leads.find((l: any) => l.lead_id === selectedLeadId)?.lead_id)}
                      style={{ ...btnBase, width: '100%', marginTop: '10px', padding: '10px', background: GRADIENT_SUCCESS, color: '#1a1a2e', fontWeight: 700, opacity: sendingLeadId ? 0.5 : 1 }}>
                      {sendingLeadId ? 'Sending...' : `Send to ${(leads.find((l: any) => l.lead_id === selectedLeadId) as any)?.email || 'lead'}`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: TXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Topic / Keyword</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AI marketing trends, SaaS growth strategies"
            style={inputSx} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: TXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Tone</label>
          <TooltipWrap text="Controls the writing style — Professional (formal), Friendly (conversational), Casual (relaxed), or Formal (highly polished)">
            <select value={tone} onChange={(e) => setTone(e.target.value as any)} style={selectSx}>
              <option value="professional" style={optionSx}>Professional — Formal & polished</option>
              <option value="friendly" style={optionSx}>Friendly — Warm & conversational</option>
              <option value="casual" style={optionSx}>Casual — Relaxed & informal</option>
              <option value="formal" style={optionSx}>Formal — Highly structured & official</option>
            </select>
          </TooltipWrap>
        </div>

        {selectedLeadId ? (
          <TooltipWrap text="Generates a fully personalized email using lead context (name, summary, guidelines, pitch angle)">
            <button onClick={handleGeneratePersonalized} disabled={!topic.trim() || isGenerating}
              style={{ ...btnBase, width: '100%', padding: '14px', background: GRADIENT_PRIMARY, color: '#fff', marginBottom: '20px', opacity: !topic.trim() || isGenerating ? 0.5 : 1 }}>
              {isGenerating ? 'Generating personalized email...' : 'Generate Personalized Email'}
            </button>
          </TooltipWrap>
        ) : (
          <TooltipWrap text="Generates a complete outreach email with subject + body using AI">
            <button onClick={handleGenerate} disabled={!topic.trim() || isGenerating}
              style={{ ...btnBase, width: '100%', padding: '14px', background: GRADIENT_PRIMARY, color: '#fff', marginBottom: '20px', opacity: !topic.trim() || isGenerating ? 0.5 : 1 }}>
              {isGenerating ? 'Generating with AI...' : 'Generate with AI'}
            </button>
          </TooltipWrap>
        )}

        <AdvancedSettings
          compliance={{
            senderEmail, setSenderEmail,
            unsubscribeUrl, setUnsubscribeUrl, oneClickUnsubscribe, setOneClickUnsubscribe,
            legalBasis, setLegalBasis, contactDiscoverySource, setContactDiscoverySource,
            recipientRegion, setRecipientRegion, recipientRegionSource, setRecipientRegionSource,
            consentStatus, setConsentStatus, approvedByHuman, setApprovedByHuman,
          }}
          onComplianceChange={setComplianceReady}
        />

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

        {/* Suppression List */}
        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>Suppression List</h4>
            <TooltipWrap text="Toggle suppression list view">
              <button onClick={() => { setShowSuppressionList(!showSuppressionList); if (!showSuppressionList) onFetchSuppressedList(); }}
                style={{ ...btnBase, padding: '6px 14px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: TXT_HEADING }}>
                {showSuppressionList ? 'Hide' : 'Manage'}
              </button>
            </TooltipWrap>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input type="email" value={suppressionEmail} onChange={(e) => setSuppressionEmail(e.target.value)}
              placeholder="Email to suppress" style={{ ...inputSx, flex: 1 }} />
            <input type="text" value={suppressionReason} onChange={(e) => setSuppressionReason(e.target.value)}
              placeholder="Reason (optional)" style={{ ...inputSx, flex: 1 }} />
            <TooltipWrap text="Add email to suppression list — prevents future sends">
              <button onClick={async () => {
                if (!suppressionEmail.trim()) return;
                await onAddSuppressedRecipient(suppressionEmail.trim(), suppressionReason.trim() || 'manual');
                setSuppressionEmail('');
                setSuppressionReason('');
                showToastNotification(`Suppressed ${suppressionEmail.trim()}`, 'success');
              }} disabled={!suppressionEmail.trim()}
                style={{ ...btnBase, padding: '8px 16px', fontSize: '12px', background: GRADIENT_SECONDARY, color: '#fff', opacity: suppressionEmail.trim() ? 1 : 0.4 }}>
                Suppress
              </button>
            </TooltipWrap>
          </div>
          {showSuppressionList && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {suppressedList.length === 0 ? (
                <p style={{ fontSize: '12px', color: TXT_FAINT, padding: '12px 0', textAlign: 'center' }}>
                  No suppressed recipients.
                </p>
              ) : (
                suppressedList.map((s: any) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', color: '#fff' }}>{s.email}</span>
                      {s.reason && <span style={{ fontSize: '11px', color: TXT_MUTED, marginLeft: '8px' }}>({s.reason})</span>}
                    </div>
                    <TooltipWrap text="Remove from suppression list">
                      <button onClick={async () => { await onRemoveSuppressedRecipient(s.id); }}
                        style={{ ...btnBase, padding: '4px 10px', fontSize: '11px', background: 'rgba(245,87,108,0.2)', color: '#f5576c', border: '1px solid rgba(245,87,108,0.3)' }}>
                        Remove
                      </button>
                    </TooltipWrap>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {selectedCampaign && subject.trim() && body.trim() && (
          <div style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: complianceReady ? 'rgba(67,233,123,0.1)' : 'rgba(245,87,108,0.1)', border: `1px solid ${complianceReady ? 'rgba(67,233,123,0.2)' : 'rgba(245,87,108,0.2)'}` }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: complianceReady ? '#43e97b' : '#f5576c' }}>
              {complianceReady ? <>Ready to send this email to leads in <strong>{selectedCampaign.name}</strong>.</> : <>Complete compliance metadata before sending to <strong>{selectedCampaign.name}</strong> leads.</>}
            </p>
            <TooltipWrap text={complianceReady ? 'Go to the Leads tab to select recipients and send' : 'Policy validation will block sends until all listed compliance fields are complete'}>
              <button onClick={onGoToLeads} disabled={!complianceReady}
                style={{ ...btnBase, padding: '8px 20px', background: GRADIENT_SUCCESS, color: '#1a1a2e', fontSize: '13px', opacity: complianceReady ? 1 : 0.5 }}>
                Go to Workspace Leads
              </button>
            </TooltipWrap>
          </div>
        )}
      </div>

      <EmailPreview
        subject={subject}
        body={body}
        selectedLeadId={selectedLeadId}
        leads={leads}
        topic={topic}
        complianceReady={complianceReady}
        leadsWithEmail={leadsWithEmail}
        onPersonalize={handlePersonalize}
        personalizable={!!(leadName.trim() && leadSite.trim() && leadContentTopic.trim())}
        isGenerating={isGenerating}
        onFollowUp={handleFollowUp}
        followUpDisabled={!subject.trim() || !body.trim()}
        followUpDays={followUpDays}
        setFollowUpDays={setFollowUpDays}
        replyContext={replyContext}
        setReplyContext={setReplyContext}
      />
      <EmailGenerationModal
        isOpen={genModalOpen}
        mode={genMode}
        error={genError}
        onClose={closeGenModal}
      />
    </div>
  );
};

export default ComposerTab;
