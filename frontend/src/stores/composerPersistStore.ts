import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ComposerPersistState {
  selectedTemplateId: string;
  topic: string;
  targetSite: string;
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  followUpDays: number;
  replyContext: string;
  selectedLeadId: string;
  subject: string;
  body: string;
  senderEmail: string;
  unsubscribeUrl: string;
  oneClickUnsubscribe: boolean;
  legalBasis: string;
  contactDiscoverySource: string;
  recipientRegion: string;
  recipientRegionSource: string;
  consentStatus: string;
  approvedByHuman: boolean;
  senderName: string;
  senderOrganization: string;
  senderAddress: string;
  showAdvanced: boolean;

  setSelectedTemplateId: (v: string) => void;
  setTopic: (v: string) => void;
  setTargetSite: (v: string) => void;
  setTone: (v: 'professional' | 'friendly' | 'casual' | 'formal') => void;
  setFollowUpDays: (v: number) => void;
  setReplyContext: (v: string) => void;
  setSelectedLeadId: (v: string) => void;
  setSubject: (v: string) => void;
  setBody: (v: string) => void;
  setSenderEmail: (v: string) => void;
  setUnsubscribeUrl: (v: string) => void;
  setOneClickUnsubscribe: (v: boolean) => void;
  setLegalBasis: (v: string) => void;
  setContactDiscoverySource: (v: string) => void;
  setRecipientRegion: (v: string) => void;
  setRecipientRegionSource: (v: string) => void;
  setConsentStatus: (v: string) => void;
  setApprovedByHuman: (v: boolean) => void;
  setSenderName: (v: string) => void;
  setSenderOrganization: (v: string) => void;
  setSenderAddress: (v: string) => void;
  setShowAdvanced: (v: boolean) => void;
  resetComposer: () => void;
}

export const useComposerPersistStore = create<ComposerPersistState>()(
  persist(
    (set) => ({
      selectedTemplateId: '',
      topic: '',
      targetSite: '',
      tone: 'professional',
      followUpDays: 7,
      replyContext: '',
      selectedLeadId: '',
      subject: '',
      body: '',
      senderEmail: '',
      unsubscribeUrl: '',
      oneClickUnsubscribe: false,
      legalBasis: 'legitimate_interest',
      contactDiscoverySource: '',
      recipientRegion: 'unknown',
      recipientRegionSource: 'user_attested',
      consentStatus: 'unknown',
      approvedByHuman: false,
      senderName: '',
      senderOrganization: '',
      senderAddress: '',
      showAdvanced: false,

      setSelectedTemplateId: (v) => set({ selectedTemplateId: v }),
      setTopic: (v) => set({ topic: v }),
      setTargetSite: (v) => set({ targetSite: v }),
      setTone: (v) => set({ tone: v }),
      setFollowUpDays: (v) => set({ followUpDays: v }),
      setReplyContext: (v) => set({ replyContext: v }),
      setSelectedLeadId: (v) => set({ selectedLeadId: v }),
      setSubject: (v) => set({ subject: v }),
      setBody: (v) => set({ body: v }),
      setSenderEmail: (v) => set({ senderEmail: v }),
      setUnsubscribeUrl: (v) => set({ unsubscribeUrl: v }),
      setOneClickUnsubscribe: (v) => set({ oneClickUnsubscribe: v }),
      setLegalBasis: (v) => set({ legalBasis: v }),
      setContactDiscoverySource: (v) => set({ contactDiscoverySource: v }),
      setRecipientRegion: (v) => set({ recipientRegion: v }),
      setRecipientRegionSource: (v) => set({ recipientRegionSource: v }),
      setConsentStatus: (v) => set({ consentStatus: v }),
      setApprovedByHuman: (v) => set({ approvedByHuman: v }),
      setSenderName: (v) => set({ senderName: v }),
      setSenderOrganization: (v) => set({ senderOrganization: v }),
      setSenderAddress: (v) => set({ senderAddress: v }),
      setShowAdvanced: (v) => set({ showAdvanced: v }),
      resetComposer: () => set({
        selectedTemplateId: '', topic: '', targetSite: '', tone: 'professional',
        followUpDays: 7, replyContext: '', selectedLeadId: '',
        subject: '', body: '', senderEmail: '', unsubscribeUrl: '',
        oneClickUnsubscribe: false, legalBasis: 'legitimate_interest',
        contactDiscoverySource: '', recipientRegion: 'unknown',
        recipientRegionSource: 'user_attested', consentStatus: 'unknown',
        approvedByHuman: false, senderName: '', senderOrganization: '',
        senderAddress: '', showAdvanced: false,
      }),
    }),
    {
      name: 'alwrity-composer-persist',
      partialize: (state) => ({
        selectedTemplateId: state.selectedTemplateId,
        topic: state.topic,
        targetSite: state.targetSite,
        tone: state.tone,
        followUpDays: state.followUpDays,
        replyContext: state.replyContext,
        selectedLeadId: state.selectedLeadId,
        subject: state.subject,
        body: state.body,
        senderEmail: state.senderEmail,
        unsubscribeUrl: state.unsubscribeUrl,
        oneClickUnsubscribe: state.oneClickUnsubscribe,
        legalBasis: state.legalBasis,
        contactDiscoverySource: state.contactDiscoverySource,
        recipientRegion: state.recipientRegion,
        recipientRegionSource: state.recipientRegionSource,
        consentStatus: state.consentStatus,
        approvedByHuman: state.approvedByHuman,
        senderName: state.senderName,
        senderOrganization: state.senderOrganization,
        senderAddress: state.senderAddress,
        showAdvanced: state.showAdvanced,
      }),
    }
  )
);
