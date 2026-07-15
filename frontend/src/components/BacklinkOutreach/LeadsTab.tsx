import React from 'react';
import {
  BacklinkCampaignRecord,
  CampaignDetailResponse,
  CampaignAnalyticsResponse,
  OutreachAttemptRecord,
  OutreachReplyRecord,
  FollowUpScheduleRecord,
} from '../../api/backlinkOutreachApi';
import { showToastNotification } from '../../utils/toastNotifications';

type LeadStatus = 'discovered' | 'contacted' | 'replied' | 'placed' | 'bounced' | 'unsubscribed';

const STATUS_OPTIONS: LeadStatus[] = ['discovered', 'contacted', 'replied', 'placed', 'bounced', 'unsubscribed'];

const STATUS_EXPLANATIONS: Record<string, string> = {
  discovered: 'Lead found but not yet contacted',
  contacted: 'Outreach email has been sent',
  replied: 'Lead has responded to outreach',
  placed: 'Guest post successfully published',
  bounced: 'Email bounced — invalid or inactive',
  unsubscribed: 'Lead opted out of future emails',
};

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

const selectSx: React.CSSProperties = { ...inputSx, cursor: 'pointer' };

const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
  fontSize: '14px', padding: '10px 24px', transition: 'all 0.2s',
};

const TooltipWrap: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [show, setShow] = React.useState(false);
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

const renderStatusBadge = (status: string) => {
  const styles: Record<string, { bg: string; fg: string }> = {
    discovered: { bg: 'rgba(102,126,234,0.2)', fg: '#8b9cf7' },
    contacted: { bg: 'rgba(240,147,251,0.2)', fg: '#f093fb' },
    replied: { bg: 'rgba(67,233,123,0.2)', fg: '#43e97b' },
    placed: { bg: 'rgba(67,233,123,0.3)', fg: '#38f9d7' },
    bounced: { bg: 'rgba(245,87,108,0.2)', fg: '#f5576c' },
    unsubscribed: { bg: 'rgba(254,225,64,0.15)', fg: '#fee140' },
  };
  const s = styles[status] || { bg: 'rgba(255,255,255,0.1)', fg: 'rgba(255,255,255,0.6)' };
  return (
    <TooltipWrap text={STATUS_EXPLANATIONS[status] || ''}>
      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.fg, border: `1px solid ${s.fg}33` }}>
        {status}
      </span>
    </TooltipWrap>
  );
};

interface LeadsTabProps {
  campaigns: BacklinkCampaignRecord[];
  selectedCampaign: CampaignDetailResponse | null;
  analytics: CampaignAnalyticsResponse | null;
  attempts: OutreachAttemptRecord[];
  replies: OutreachReplyRecord[];
  followups: FollowUpScheduleRecord[];
  selectedLeadIds: Set<string>;
  bulkStatus: LeadStatus;
  isStatusUpdating: boolean;
  isExporting: string | null;
  sendingLeadId: string | null;
  subject: string;
  body: string;
  onSelectCampaign: (campaignId: string) => void;
  onSendToLead: (lead: any) => void;
  onSingleStatusUpdate: (leadId: string, status: LeadStatus) => void;
  onBulkStatusUpdate: () => void;
  onToggleLeadSelection: (leadId: string) => void;
  onToggleAllLeads: () => void;
  onExportCsv: (type: 'leads' | 'attempts' | 'replies') => void;
  onGoToCampaigns: () => void;
  onGoToDiscover: () => void;
  onSetBulkStatus: (status: LeadStatus) => void;
}

const LeadsTab: React.FC<LeadsTabProps> = ({
  campaigns, selectedCampaign, analytics, attempts, replies, followups,
  selectedLeadIds, bulkStatus, isStatusUpdating, isExporting, sendingLeadId,
  subject, body,
  onSelectCampaign, onSendToLead, onSingleStatusUpdate, onBulkStatusUpdate,
  onToggleLeadSelection, onToggleAllLeads, onExportCsv, onGoToCampaigns, onGoToDiscover,
  onSetBulkStatus,
}) => {
  const [leadFilters, setLeadFilters] = React.useState<{ emailFilter: 'all' | 'with_email' | 'no_email'; minQuality: number }>({ emailFilter: 'all', minQuality: 0 });
  const [showLeadFilters, setShowLeadFilters] = React.useState(false);

  const filteredLeads = selectedCampaign?.leads ? selectedCampaign.leads.filter((lead: any) => {
    if (leadFilters.emailFilter === 'with_email' && !lead.email) return false;
    if (leadFilters.emailFilter === 'no_email' && lead.email) return false;
    if (leadFilters.minQuality > 0 && (lead.confidence_score * 100) < leadFilters.minQuality) return false;
    return true;
  }) : [];

  if (!selectedCampaign) {
    return (
      <div style={{ ...cardSx, padding: '24px' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📋</div>
          <p style={{ color: TXT_MUTED, fontSize: '15px', marginBottom: '8px' }}>
            No campaign selected
          </p>
          <p style={{ color: TXT_FAINT, fontSize: '13px', marginBottom: '20px' }}>
            Create a campaign, discover opportunities, save leads — then come here to manage them.
          </p>
          <button onClick={onGoToCampaigns}
            style={{
              padding: '10px 24px', fontSize: '14px', border: 'none', borderRadius: '8px',
              background: GRADIENT_PRIMARY, color: '#fff', cursor: 'pointer',
            }}>
            Go to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardSx, padding: '24px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff' }}>{selectedCampaign.name}</h3>
            <p style={{ fontSize: '13px', color: TXT_MUTED, margin: '4px 0 0' }}>
              {selectedCampaign.lead_count} leads &middot; Status: {selectedCampaign.status}
            </p>
          </div>
          <TooltipWrap text="Switch to a different campaign">
            <select onChange={(e) => { const c = campaigns.find(x => x.campaign_id === e.target.value); if (c) onSelectCampaign(c.campaign_id); }}
              value={selectedCampaign.campaign_id} style={{ ...selectSx, padding: '8px 12px', fontSize: '13px', minWidth: '180px' }}>
              {campaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
            </select>
          </TooltipWrap>
        </div>

        {/* Lead info explainer */}
        <details style={{ marginBottom: '16px', fontSize: '12px', color: TXT_MUTED }}>
          <summary style={{ cursor: 'pointer', marginBottom: '4px', fontWeight: 500 }}>
            About these leads — how they're discovered and enriched
          </summary>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', lineHeight: 1.6, fontSize: '12px' }}>
            <p style={{ margin: '0 0 8px', color: TXT_BODY }}>
              Each lead represents a guest-post opportunity found by searching 8 query patterns (e.g. <code style={{ fontSize: '11px' }}>"keyword write for us"</code>).
            </p>
            <p style={{ margin: '0 0 8px', color: TXT_MUTED }}>
              <strong style={{ color: TXT_HEADING }}>Email</strong> — extracted from the page text via regex, <code>mailto:</code> links, or obfuscated patterns.
              If the page has a <code>/contact</code> or <code>/about</code> page, it's scraped for emails too. As a last resort, Tavily search is used.
            </p>
            <p style={{ margin: '0', color: TXT_MUTED }}>
              <strong style={{ color: TXT_HEADING }}>Status</strong> — tracks your outreach progress: discovered → contacted → replied → placed.
              Click any status button to update a lead. Use bulk actions to update many at once.
            </p>
          </div>
        </details>

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
                  <div style={{ fontSize: '11px', color: TXT_MUTED, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                </div>
              </TooltipWrap>
            ))}
          </div>
        )}

        {/* Reply classification */}
        {analytics && Object.keys(analytics.reply_classification).length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: TXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Reply Classification</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {Object.entries(analytics.reply_classification).map(([cls, count]) => (
                <TooltipWrap key={cls} text={`${count} replies classified as "${cls}"`}>
                  <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '12px', color: TXT_HEADING }}>
                    <strong>{cls}</strong>: {count}
                  </span>
                </TooltipWrap>
              ))}
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {selectedCampaign.leads && selectedCampaign.leads.length > 0 && (
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px',
            padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', flexWrap: 'wrap',
          }}>
            <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: TXT_HEADING }}>
              <input type="checkbox" checked={selectedLeadIds.size === selectedCampaign.leads.length && selectedCampaign.leads.length > 0}
                onChange={onToggleAllLeads} style={{ accentColor: '#667eea' }} />
              {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} selected` : 'Select all'}
            </label>
            {selectedLeadIds.size > 0 && (
              <>
                <TooltipWrap text="Choose the new status for all selected leads">
                  <select value={bulkStatus} onChange={(e) => onSetBulkStatus(e.target.value as LeadStatus)}
                    style={{ ...selectSx, padding: '6px 10px', fontSize: '12px', minWidth: '130px' }}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </TooltipWrap>
                <TooltipWrap text="Updates the status of all selected leads in one click">
                  <button onClick={onBulkStatusUpdate} disabled={isStatusUpdating}
                    style={{ ...btnBase, padding: '6px 16px', fontSize: '12px', background: GRADIENT_PRIMARY, color: '#fff', opacity: isStatusUpdating ? 0.5 : 1 }}>
                    {isStatusUpdating ? 'Updating...' : 'Update Status'}
                  </button>
                </TooltipWrap>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {(!selectedCampaign.leads || selectedCampaign.leads.length === 0) && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>🔍</div>
            <p style={{ color: TXT_MUTED, fontSize: '15px', marginBottom: '8px' }}>
              {selectedCampaign.leads ? 'No leads in this campaign yet' : 'Loading leads...'}
            </p>
            <p style={{ color: TXT_FAINT, fontSize: '13px', marginBottom: '20px' }}>
              Use the Discover tab to search for guest post opportunities and save them here.
            </p>
            <button onClick={onGoToDiscover}
              style={{
                padding: '10px 24px', fontSize: '14px', border: 'none', borderRadius: '8px',
                background: GRADIENT_PRIMARY, color: '#fff', cursor: 'pointer',
              }}>
              Go to Discover
            </button>
          </div>
        )}

        {/* Lead filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>
            {selectedCampaign.leads?.length || 0} leads
          </span>
          <button onClick={() => setShowLeadFilters(p => !p)}
            style={{ ...btnBase, padding: '6px 10px', fontSize: '12px', background: showLeadFilters ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.06)', color: showLeadFilters ? '#8b9cf7' : TXT_BODY, border: showLeadFilters ? '1px solid rgba(102,126,234,0.3)' : '1px solid transparent' }}>
            Filters {showLeadFilters ? '▲' : '▼'}
          </button>
        </div>

        {showLeadFilters && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
            <span style={{ color: TXT_MUTED }}>Email:</span>
            <select value={leadFilters.emailFilter} onChange={(e) => setLeadFilters(f => ({ ...f, emailFilter: e.target.value as 'all' | 'with_email' | 'no_email' }))}
              style={{ ...selectSx, padding: '6px 10px', fontSize: '13px', minWidth: '100px', width: 'auto' }}>
              <option value="all">All</option>
              <option value="with_email">Has email</option>
              <option value="no_email">No email</option>
            </select>
            <span style={{ color: TXT_MUTED }}>Min Confidence:</span>
            <input type="range" min={0} max={100} value={leadFilters.minQuality}
              onChange={(e) => setLeadFilters(f => ({ ...f, minQuality: Number(e.target.value) }))}
              style={{ width: '120px', accentColor: '#667eea', verticalAlign: 'middle' }} />
            <span style={{ color: '#fff', minWidth: '32px' }}>{leadFilters.minQuality}%</span>
            {leadFilters.emailFilter !== 'all' || leadFilters.minQuality > 0 ? (
              <button onClick={() => setLeadFilters({ emailFilter: 'all', minQuality: 0 })}
                style={{ ...btnBase, padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: TXT_MUTED }}>
                Reset
              </button>
            ) : null}
            <span style={{ color: TXT_FAINT, marginLeft: 'auto', fontSize: '12px' }}>
              Showing {filteredLeads.length} of {selectedCampaign.leads?.length || 0}
            </span>
          </div>
        )}

        {/* Lead cards */}
        {selectedCampaign.leads && selectedCampaign.leads.length > 0 && filteredLeads.length === 0 && (
          <p style={{ color: TXT_FAINT, textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
            No leads match the current filters.
            <button onClick={() => setLeadFilters({ emailFilter: 'all', minQuality: 0 })}
              style={{ marginLeft: '8px', ...btnBase, padding: '4px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: '#8b9cf7' }}>
              Reset filters
            </button>
          </p>
        )}
        {filteredLeads.map((lead: any) => (
          <div key={lead.lead_id} style={{
            padding: '16px', marginBottom: '8px', borderRadius: '10px',
            background: selectedLeadIds.has(lead.lead_id) ? 'rgba(102,126,234,0.1)' : 'rgba(255,255,255,0.03)',
            border: selectedLeadIds.has(lead.lead_id) ? '1px solid rgba(102,126,234,0.3)' : '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input type="checkbox" checked={selectedLeadIds.has(lead.lead_id)}
                onChange={() => onToggleLeadSelection(lead.lead_id)} style={{ marginTop: '4px', accentColor: '#667eea' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{lead.page_title || lead.domain}</div>
                <div style={{ fontSize: '13px', color: TXT_MUTED, marginBottom: '4px' }}>
                  {lead.url && <a href={lead.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b9cf7' }}>{lead.url}</a>}
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: TXT_MUTED, alignItems: 'center', flexWrap: 'wrap' }}>
                  {renderStatusBadge(lead.status)}
                  <TooltipWrap text={lead.email ? `Found via ${lead.discovery_source || 'page text'}` : 'No email found — the scraper checks page text, contact pages, and search results'}>
                    <span>Email: {lead.email || <span style={{ color: TXT_FAINT, fontStyle: 'italic' }}>not found</span>}</span>
                  </TooltipWrap>
                  <TooltipWrap text={`Discovered via ${lead.discovery_source || 'unknown source'}`}>
                    <span>Source: {lead.discovery_source}</span>
                  </TooltipWrap>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map((s) => (
                    <TooltipWrap key={s} text={STATUS_EXPLANATIONS[s] || ''}>
                      <button onClick={() => onSingleStatusUpdate(lead.lead_id, s)}
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
                {lead.email && (
                  <div style={{ marginTop: '8px' }}>
                    <TooltipWrap text="Send the composed email (from Composer tab) to this lead">
                      <button onClick={() => onSendToLead(lead)}
                        disabled={sendingLeadId === lead.lead_id || !subject.trim() || !body.trim()}
                        style={{
                          ...btnBase, padding: '6px 16px', fontSize: '12px',
                          background: GRADIENT_PRIMARY, color: '#fff',
                          opacity: sendingLeadId === lead.lead_id ? 0.5 : (!subject.trim() || !body.trim() ? 0.4 : 1),
                        }}>
                        {sendingLeadId === lead.lead_id ? 'Sending...' : 'Send Email'}
                      </button>
                    </TooltipWrap>
                  </div>
                )}
                {attempts.filter((a: any) => a.lead_id === lead.lead_id).slice(0, 1).map((a: any) => (
                  <div key={a.attempt_id} style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '12px' }}>
                    <span style={{ color: TXT_MUTED }}>Latest: {a.subject} — </span>
                    {renderStatusBadge(a.status)}
                    {a.sender_email && <span style={{ color: TXT_FAINT, marginLeft: '8px' }}>From: {a.sender_email}</span>}
                    {a.sent_at && <span style={{ color: TXT_FAINT, marginLeft: '8px' }}>{new Date(a.sent_at).toLocaleString()}</span>}
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
                      <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: TXT_MUTED, fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: any) => (
                    <tr key={a.attempt_id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#fff', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.subject}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{renderStatusBadge(a.status)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: TXT_MUTED, fontSize: '12px' }}>{a.sender_email}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: TXT_MUTED, fontSize: '12px' }}>{a.sent_at ? new Date(a.sent_at).toLocaleDateString() : '-'}</td>
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
              {replies.map((r: any) => (
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
                  <div style={{ fontSize: '12px', color: TXT_FAINT, marginBottom: '6px' }}>From: {r.from_email} &middot; {r.received_at ? new Date(r.received_at).toLocaleString() : ''}</div>
                  <div style={{ fontSize: '13px', color: TXT_BODY, whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}>{r.body.slice(0, 300)}</div>
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
              {followups.map((f: any) => (
                <div key={f.schedule_id} style={{
                  padding: '12px 16px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: '#fff' }}>{f.subject}</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {f.scheduled_for && <span style={{ color: TXT_MUTED, fontSize: '12px' }}>{new Date(f.scheduled_for).toLocaleDateString()}</span>}
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
    </div>
  );
};

export default LeadsTab;
