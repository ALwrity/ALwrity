import { useState, useCallback } from 'react';
import {
  sendOutreach,
  updateLeadStatus,
  SendOutreachRequest,
} from '../../api/backlinkOutreachApi';
import { showToastNotification } from '../../utils/toastNotifications';
import { useComposerPersistStore } from '../../stores/composerPersistStore';

export interface ComposerState {
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
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
  sendingLeadId: string | null;
  handleSendToLead: (lead: any, selectedCampaign: any) => Promise<void>;
}

interface UseComposerStateParams {
  userId: string | null | undefined;
  workspaceId: string;
  fetchAttempts: (campaignId: string) => void;
  selectCampaign: (campaignId: string) => Promise<any>;
}

export function useComposerState(params: UseComposerStateParams): ComposerState {
  const { userId, workspaceId, fetchAttempts, selectCampaign } = params;

  const subject = useComposerPersistStore((s) => s.subject);
  const setSubject = useComposerPersistStore((s) => s.setSubject);
  const body = useComposerPersistStore((s) => s.body);
  const setBody = useComposerPersistStore((s) => s.setBody);
  const senderEmail = useComposerPersistStore((s) => s.senderEmail);
  const setSenderEmail = useComposerPersistStore((s) => s.setSenderEmail);
  const unsubscribeUrl = useComposerPersistStore((s) => s.unsubscribeUrl);
  const setUnsubscribeUrl = useComposerPersistStore((s) => s.setUnsubscribeUrl);
  const oneClickUnsubscribe = useComposerPersistStore((s) => s.oneClickUnsubscribe);
  const setOneClickUnsubscribe = useComposerPersistStore((s) => s.setOneClickUnsubscribe);
  const legalBasis = useComposerPersistStore((s) => s.legalBasis);
  const setLegalBasis = useComposerPersistStore((s) => s.setLegalBasis);
  const contactDiscoverySource = useComposerPersistStore((s) => s.contactDiscoverySource);
  const setContactDiscoverySource = useComposerPersistStore((s) => s.setContactDiscoverySource);
  const recipientRegion = useComposerPersistStore((s) => s.recipientRegion);
  const setRecipientRegion = useComposerPersistStore((s) => s.setRecipientRegion);
  const recipientRegionSource = useComposerPersistStore((s) => s.recipientRegionSource);
  const setRecipientRegionSource = useComposerPersistStore((s) => s.setRecipientRegionSource);
  const consentStatus = useComposerPersistStore((s) => s.consentStatus);
  const setConsentStatus = useComposerPersistStore((s) => s.setConsentStatus);
  const approvedByHuman = useComposerPersistStore((s) => s.approvedByHuman);
  const setApprovedByHuman = useComposerPersistStore((s) => s.setApprovedByHuman);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);

  const handleSendToLead = useCallback(async (lead: any, selectedCampaign: any) => {
    const snap = useComposerPersistStore.getState();
    if (!snap.subject.trim() || !snap.body.trim()) {
      showToastNotification('Compose an email first', 'error');
      return;
    }
    if (!snap.senderEmail.trim()) {
      showToastNotification('Enter a sender email', 'error');
      return;
    }
    setSendingLeadId(lead.lead_id);
    try {
      const idempotencyKey = `bo_${Date.now()}_${lead.lead_id}`;
      const payload: SendOutreachRequest = {
        lead_id: lead.lead_id,
        campaign_id: lead.campaign_id || selectedCampaign?.campaign_id || '',
        user_id: userId || 'default',
        workspace_id: workspaceId,
        sender_email: snap.senderEmail,
        subject: snap.subject.trim(),
        body: snap.body.trim(),
        idempotency_key: idempotencyKey,
        legal_basis: snap.legalBasis,
        contact_discovery_source: snap.contactDiscoverySource,
        recipient_region: snap.recipientRegion,
        recipient_region_source: snap.recipientRegionSource,
        consent_status: snap.consentStatus,
        approved_by_human: snap.approvedByHuman,
        ...(snap.unsubscribeUrl.trim() ? { unsubscribe_url: snap.unsubscribeUrl.trim() } : {}),
        ...(snap.oneClickUnsubscribe ? {
          one_click_unsubscribe: { enabled: true }
        } : {}),
      };
      const result = await sendOutreach(payload);
      if (result && result.status === 'sent') {
        showToastNotification(`Email sent to ${lead.email || lead.domain}`, 'success');
        try {
          await updateLeadStatus(lead.lead_id, { status: 'contacted', campaign_id: lead.campaign_id || selectedCampaign?.campaign_id || '' });
        } catch { /* non-blocking */ }
        if (selectedCampaign) {
          fetchAttempts(selectedCampaign.campaign_id);
          selectCampaign(selectedCampaign.campaign_id);
        }
      } else if (result) {
        const reasons = result.policy_reasons?.join(', ') || result.status;
        showToastNotification(`Send blocked: ${reasons}`, 'warning');
      }
    } catch (e: any) {
      showToastNotification(e?.message || 'Failed to send email', 'error');
    } finally {
      setSendingLeadId(null);
    }
  }, [userId, workspaceId, fetchAttempts, selectCampaign, setSendingLeadId]);

  return {
    subject, setSubject, body, setBody, senderEmail, setSenderEmail,
    unsubscribeUrl, setUnsubscribeUrl, oneClickUnsubscribe, setOneClickUnsubscribe,
    legalBasis, setLegalBasis, contactDiscoverySource, setContactDiscoverySource,
    recipientRegion, setRecipientRegion, recipientRegionSource, setRecipientRegionSource,
    consentStatus, setConsentStatus, approvedByHuman, setApprovedByHuman,
    sendingLeadId,
    handleSendToLead,
  };
}
