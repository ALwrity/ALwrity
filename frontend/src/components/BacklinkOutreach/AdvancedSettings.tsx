import React, { useState, useCallback, useEffect } from 'react';
import {
  fetchSmtpConfig,
  updateSmtpConfig,
  deleteSmtpConfig,
} from '../../api/backlinkOutreachApi';
import { showToastNotification } from '../../utils/toastNotifications';
import { useComposerPersistStore } from '../../stores/composerPersistStore';

interface ComplianceProps {
  senderEmail: string;
  setSenderEmail: (v: string) => void;
  unsubscribeUrl: string;
  setUnsubscribeUrl: (v: string) => void;
  oneClickUnsubscribe: boolean;
  setOneClickUnsubscribe: (v: boolean) => void;
  legalBasis: string;
  setLegalBasis: (v: string) => void;
  contactDiscoverySource: string;
  setContactDiscoverySource: (v: string) => void;
  recipientRegion: string;
  setRecipientRegion: (v: string) => void;
  recipientRegionSource: string;
  setRecipientRegionSource: (v: string) => void;
  consentStatus: string;
  setConsentStatus: (v: string) => void;
  approvedByHuman: boolean;
  setApprovedByHuman: (v: boolean) => void;
}

interface AdvancedSettingsProps {
  compliance: ComplianceProps;
  onComplianceChange: (ready: boolean) => void;
}

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #667eea, #764ba2)';
const TXT_HEADING = '#fff';
const TXT_MUTED = 'rgba(255,255,255,0.6)';
const TXT_FAINT = 'rgba(255,255,255,0.42)';

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

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  compliance,
  onComplianceChange,
}) => {
  const {
    senderEmail, setSenderEmail,
    unsubscribeUrl, setUnsubscribeUrl, oneClickUnsubscribe, setOneClickUnsubscribe,
    legalBasis, setLegalBasis, contactDiscoverySource, setContactDiscoverySource,
    recipientRegion, setRecipientRegion, recipientRegionSource, setRecipientRegionSource,
    consentStatus, setConsentStatus, approvedByHuman, setApprovedByHuman,
  } = compliance;

  const senderName = useComposerPersistStore((s) => s.senderName);
  const setSenderName = useComposerPersistStore((s) => s.setSenderName);
  const senderOrganization = useComposerPersistStore((s) => s.senderOrganization);
  const setSenderOrganization = useComposerPersistStore((s) => s.setSenderOrganization);
  const senderAddress = useComposerPersistStore((s) => s.senderAddress);
  const setSenderAddress = useComposerPersistStore((s) => s.setSenderAddress);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [smtpVerifyTls, setSmtpVerifyTls] = useState(true);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const showAdvanced = useComposerPersistStore((s) => s.showAdvanced);
  const setShowAdvanced = useComposerPersistStore((s) => s.setShowAdvanced);

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

  useEffect(() => {
    onComplianceChange(complianceReady);
  }, [complianceReady, onComplianceChange]);

  const handleLoadSmtpConfig = useCallback(async () => {
    try {
      const cfg = await fetchSmtpConfig();
      if (cfg && cfg.host) {
        setSmtpHost(cfg.host);
        setSmtpPort(cfg.port || 587);
        setSmtpUsername(cfg.username || '');
        setSmtpFromEmail(cfg.from_email || '');
        setSmtpUseTls(cfg.use_tls !== false);
        setSmtpVerifyTls(cfg.verify_tls !== false);
        showToastNotification('SMTP config loaded', 'success');
      } else {
        showToastNotification('No SMTP config found — using server defaults', 'info');
      }
    } catch (e) {
      showToastNotification('Failed to load SMTP config', 'error');
    }
  }, []);

  const handleSaveSmtpConfig = useCallback(async () => {
    if (!smtpUsername.trim() || !smtpPassword.trim()) return;
    setIsSavingSmtp(true);
    try {
      await updateSmtpConfig({
        host: smtpHost || 'smtp.gmail.com',
        port: smtpPort || 587,
        username: smtpUsername.trim(),
        password: smtpPassword,
        from_email: smtpFromEmail.trim() || undefined,
        use_tls: smtpUseTls,
        verify_tls: smtpVerifyTls,
        timeout: 30,
      });
      showToastNotification('SMTP config saved', 'success');
    } catch (e) {
      showToastNotification('Failed to save SMTP config', 'error');
    } finally {
      setIsSavingSmtp(false);
    }
  }, [smtpHost, smtpPort, smtpUsername, smtpPassword, smtpFromEmail, smtpUseTls, smtpVerifyTls]);

  const handleDeleteSmtpConfig = useCallback(async () => {
    setIsSavingSmtp(true);
    try {
      await deleteSmtpConfig();
      setSmtpHost('');
      setSmtpPort(587);
      setSmtpUsername('');
      setSmtpPassword('');
      setSmtpFromEmail('');
      setSmtpUseTls(true);
      setSmtpVerifyTls(true);
      showToastNotification('SMTP config reset to server defaults', 'success');
    } catch (e) {
      showToastNotification('Failed to reset SMTP config', 'error');
    } finally {
      setIsSavingSmtp(false);
    }
  }, []);

  return (
    <>
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ ...btnBase, width: '100%', padding: '10px', background: 'rgba(255,255,255,0.04)', color: TXT_MUTED, border: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          {showAdvanced ? '▼' : '▶'} Advanced Settings
        </button>
      </div>

      {showAdvanced && (<>
        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: complianceReady ? 'rgba(67,233,123,0.08)' : 'rgba(245,87,108,0.08)', border: `1px solid ${complianceReady ? 'rgba(67,233,123,0.22)' : 'rgba(245,87,108,0.22)'}` }}>
          <h4 style={{ margin: '0 0 4px', color: '#fff', fontSize: '14px' }}>Compliance Metadata</h4>
          <p style={{ margin: '0 0 12px', color: TXT_MUTED, fontSize: '12px' }}>Policy checks require unsubscribe, sender identity, legal basis, contact source, and region-aware consent/review details before a send can be approved.</p>

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
              <option value="legitimate_interest" style={optionSx}>Legitimate interest</option>
              <option value="consent" style={optionSx}>Consent</option>
              <option value="contract" style={optionSx}>Contract</option>
            </select>
            <input type="text" value={contactDiscoverySource} onChange={(e) => setContactDiscoverySource(e.target.value)} placeholder="Contact discovery source (e.g. contact page URL)" style={inputSx} />
            <select value={recipientRegion} onChange={(e) => setRecipientRegion(e.target.value)} style={selectSx}>
              <option value="unknown" style={optionSx}>Recipient region unknown</option>
              <option value="us" style={optionSx}>United States</option>
              <option value="eu" style={optionSx}>EU / EEA</option>
              <option value="uk" style={optionSx}>United Kingdom</option>
              <option value="ca" style={optionSx}>Canada</option>
              <option value="au" style={optionSx}>Australia</option>
              <option value="br" style={optionSx}>Brazil</option>
              <option value="other" style={optionSx}>Other</option>
            </select>
            <select value={recipientRegionSource} onChange={(e) => setRecipientRegionSource(e.target.value)} style={selectSx}>
              <option value="user_attested" style={optionSx}>Region user-attested</option>
              <option value="crm_record" style={optionSx}>Region from CRM/contact record</option>
              <option value="billing_or_profile" style={optionSx}>Region from profile/billing data</option>
              <option value="tld_inference" style={optionSx}>Region inferred from TLD only</option>
              <option value="unknown" style={optionSx}>Region source unknown</option>
            </select>
            <select value={consentStatus} onChange={(e) => setConsentStatus(e.target.value)} style={selectSx}>
              <option value="unknown" style={optionSx}>Consent status unknown</option>
              <option value="explicit" style={optionSx}>Explicit consent recorded</option>
              <option value="implied" style={optionSx}>Implied consent / soft opt-in</option>
              <option value="not_required" style={optionSx}>Not required for selected basis</option>
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

        {/* SMTP Config */}
        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>SMTP Settings</h4>
            <TooltipWrap text="SMTP config is stored per-user. Leave empty to use server defaults.">
              <span style={{ fontSize: '11px', color: TXT_FAINT, cursor: 'help' }}>?</span>
            </TooltipWrap>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="SMTP Host (e.g. smtp.gmail.com)" style={inputSx} />
            <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))}
              placeholder="Port (e.g. 587)" style={inputSx} min={1} max={65535} />
            <input type="text" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)}
              placeholder="Username" style={inputSx} />
            <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder="Password" style={inputSx} />
            <input type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)}
              placeholder="From email (optional)" style={inputSx} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ ...inputSx, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', width: 'auto', padding: '8px 12px' }}>
              <input type="checkbox" checked={smtpUseTls} onChange={(e) => setSmtpUseTls(e.target.checked)} />
              Use TLS
            </label>
            <label style={{ ...inputSx, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', width: 'auto', padding: '8px 12px' }}>
              <input type="checkbox" checked={smtpVerifyTls} onChange={(e) => setSmtpVerifyTls(e.target.checked)} />
              Verify TLS
            </label>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <TooltipWrap text="Save your SMTP settings (stored in your private workspace DB)">
              <button onClick={handleSaveSmtpConfig} disabled={!smtpUsername.trim() || !smtpPassword.trim() || isSavingSmtp}
                style={{ ...btnBase, padding: '8px 16px', fontSize: '12px', background: GRADIENT_PRIMARY, color: '#fff', opacity: smtpUsername.trim() && smtpPassword.trim() && !isSavingSmtp ? 1 : 0.4 }}>
                {isSavingSmtp ? 'Saving...' : 'Save SMTP Config'}
              </button>
            </TooltipWrap>
            <TooltipWrap text="Remove your SMTP config and revert to server defaults">
              <button onClick={handleDeleteSmtpConfig} disabled={isSavingSmtp}
                style={{ ...btnBase, padding: '8px 16px', fontSize: '12px', background: 'rgba(245,87,108,0.2)', color: '#f5576c', border: '1px solid rgba(245,87,108,0.3)' }}>
                Reset to Defaults
              </button>
            </TooltipWrap>
            <TooltipWrap text="Load current SMTP config from your workspace">
              <button onClick={handleLoadSmtpConfig} disabled={isSavingSmtp}
                style={{ ...btnBase, padding: '8px 16px', fontSize: '12px', background: 'rgba(255,255,255,0.06)', color: TXT_HEADING }}>
                Load
              </button>
            </TooltipWrap>
          </div>
        </div>
      </>)}
    </>
  );
};

export default AdvancedSettings;
