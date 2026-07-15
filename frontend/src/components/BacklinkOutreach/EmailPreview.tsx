import React, { useState } from 'react';

interface EmailPreviewProps {
  subject: string;
  body: string;
  selectedLeadId: string;
  leads: any[];
  topic: string;
  complianceReady: boolean;
  leadsWithEmail: any[];
  onPersonalize: () => void;
  personalizable: boolean;
  isGenerating: boolean;
  onFollowUp: () => void;
  followUpDisabled: boolean;
  followUpDays: number;
  setFollowUpDays: (v: number) => void;
  replyContext: string;
  setReplyContext: (v: string) => void;
}

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #667eea, #764ba2)';
const GRADIENT_CARD = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))';
const GRADIENT_WARNING = 'linear-gradient(135deg, #fa709a, #fee140)';
const GRADIENT_SECONDARY = 'linear-gradient(135deg, #f093fb, #f5576c)';
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

const EmailPreview: React.FC<EmailPreviewProps> = ({
  subject, body, selectedLeadId, leads, topic, complianceReady, leadsWithEmail,
  onPersonalize, personalizable, isGenerating,
  onFollowUp, followUpDisabled, followUpDays, setFollowUpDays, replyContext, setReplyContext,
}) => {
  const hasEmail = !!(subject || body);
  return (
    <div style={{ ...cardSx, padding: '24px' }}>
      <SectionHeader title="Preview" subtitle="See how your email will look when received." />
      <div style={{ padding: '24px', borderRadius: '8px', background: '#fff' }}>
        {hasEmail ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '16px', padding: '0 0 12px', borderBottom: '2px solid #eee', color: '#333' }}>
              {subject || '(no subject)'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: '#555' }}>
              {body || '(no body)'}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', minHeight: '400px' }}>
            {(() => {
              const currentLead = selectedLeadId ? leads.find((l: any) => l.lead_id === selectedLeadId) : null;
              if (!selectedLeadId && leads.length === 0) {
                return (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>📧</div>
                    <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 8px' }}>No leads in this campaign yet</p>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#777', maxWidth: '400px', margin: '0 auto' }}>
                      Discover and save leads from the <strong>Discover</strong> tab first, then return here to compose personalized emails for each one.
                    </p>
                  </>
                );
              }
              if (!selectedLeadId) {
                return (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>🎯</div>
                    <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 8px' }}>Select a lead to begin</p>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#777', maxWidth: '400px', margin: '0 auto' }}>
                      Choose a lead from the <strong>Target Lead</strong> dropdown above. Once selected, AI will use their site content and context to craft a personalized outreach email.
                    </p>
                    {leads.length > 0 && (
                      <p style={{ fontSize: '12px', marginTop: '12px', color: '#999' }}>
                        {leadsWithEmail.length} of {leads.length} leads have email addresses ready for outreach.
                      </p>
                    )}
                  </>
                );
              }
              if (!topic.trim()) {
                return (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>✏️</div>
                    <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 8px' }}>Enter a topic</p>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#777', maxWidth: '400px', margin: '0 auto' }}>
                      Type the topic or keyword you want to pitch, then click <strong>Generate Personalized Email</strong> to create a tailored message for {currentLead?.page_title || currentLead?.domain || 'this lead'}.
                    </p>
                  </>
                );
              }
              if (currentLead) {
                return (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '10px', opacity: 0.4 }}>🚀</div>
                    <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 4px', color: '#333' }}>
                      Ready to reach {currentLead.ai_editor_name || currentLead.exa_author || currentLead.page_title || 'this lead'}
                    </p>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#777', maxWidth: '420px', margin: '0 auto 12px' }}>
                      Click <strong>Generate Personalized Email</strong> to create an AI-crafted pitch about "{topic}" tailored to their content and audience.
                    </p>
                    {(currentLead.exa_summary || currentLead.ai_pitch_angle) && (
                      <div style={{ textAlign: 'left', background: '#f5f5ff', borderRadius: '8px', padding: '12px', marginTop: '8px', border: '1px solid #e8e8ff' }}>
                        {currentLead.exa_summary && (
                          <div style={{ marginBottom: currentLead.ai_pitch_angle ? '8px' : 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#667eea' }}>Article Summary</span>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#555', lineHeight: 1.4 }}>{currentLead.exa_summary}</p>
                          </div>
                        )}
                        {currentLead.ai_pitch_angle && (
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#43e97b' }}>Suggested Pitch Angle</span>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#555', lineHeight: 1.4 }}>{currentLead.ai_pitch_angle}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {!complianceReady && (
                      <p style={{ fontSize: '12px', marginTop: '12px', color: '#f5576c' }}>
                        Complete the compliance metadata on the left before sending.
                      </p>
                    )}
                  </>
                );
              }
              return (
                <>
                  <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 8px' }}>Generate an email</p>
                  <p style={{ fontSize: '13px', color: '#777' }}>
                    Use the AI tools on the left to create your message.
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {hasEmail && (
        <>
          <div style={{ marginTop: '24px', padding: '16px', borderRadius: '10px', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)' }}>
            <TooltipWrap text="Rewrites your email to reference the specific lead's name, site, and content">
              <button onClick={onPersonalize} disabled={!personalizable || isGenerating}
                style={{ ...btnBase, width: '100%', padding: '10px', background: GRADIENT_WARNING, color: '#1a1a2e', opacity: personalizable && !isGenerating ? 1 : 0.5 }}>
                {selectedLeadId ? 'Personalize Email (quick edit)' : 'Personalize Email'}
              </button>
            </TooltipWrap>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '14px' }}>Draft Follow-up</h4>
            <p style={{ margin: '0 0 12px', color: TXT_MUTED, fontSize: '12px' }}>Generate a polite follow-up email to re-engage a lead who hasn't responded.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="number" value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))} min={1} max={90}
                style={{ ...inputSx, width: '80px' }} />
              <span style={{ padding: '10px 0', color: TXT_MUTED, fontSize: '13px' }}>days since original email</span>
            </div>
            <input type="text" value={replyContext} onChange={(e) => setReplyContext(e.target.value)}
              placeholder="Their reply (if any) — leave blank for no-response follow-up"
              style={{ ...inputSx, marginBottom: '10px' }} />
            <TooltipWrap text="Creates a follow-up email that references the original and any reply context">
              <button onClick={onFollowUp} disabled={followUpDisabled || isGenerating}
                style={{ ...btnBase, width: '100%', padding: '10px', background: GRADIENT_SECONDARY, color: '#fff', opacity: !followUpDisabled && !isGenerating ? 1 : 0.5 }}>
                Generate Follow-up
              </button>
            </TooltipWrap>
          </div>
        </>
      )}
    </div>
  );
};

export default EmailPreview;
