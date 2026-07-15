import { apiClient, aiApiClient } from './client';

// -- Shared Types --

export interface BacklinkModuleRecord {
  identifier: 'backlink' | 'outreach' | 'guest_post' | string;
  module_path: string;
  purpose: string;
}

export interface BacklinkModuleRegistryResponse {
  feature: string;
  modules: BacklinkModuleRecord[];
}

export interface BacklinkCoverageResponse {
  legacy_reference: string;
  implemented_count: number;
  planned_count: number;
  implemented: string[];
  planned: string[];
}

export interface BacklinkQueryTemplatesResponse {
  keyword: string;
  queries: string[];
}

// -- Discovery --

export interface BacklinkDiscoveryRequest {
  keyword: string;
  max_results?: number;
}

export interface BacklinkOpportunity {
  url: string;
  title: string;
  snippet: string;
  confidence_score: number;
}

export interface BacklinkDiscoveryResponse {
  keyword: string;
  queries: string[];
  opportunities: BacklinkOpportunity[];
}

export interface EnrichedOpportunity {
  url: string;
  domain: string;
  page_title: string;
  snippet: string;
  full_text: string;
  email: string | null;
  all_emails: string[];
  contact_page: string | null;
  confidence_score: number;
  quality_score: number;
  word_count: number;
  has_guest_post_guidelines: boolean;
  discovery_source: string;
  // Exa enrichment
  exa_score?: number;
  exa_author?: string | null;
  exa_published_date?: string | null;
  exa_summary?: string;
  exa_highlights?: string[];
  // AI Prospecting enrichment (set after AI pass)
  ai_prospected?: boolean;
  ai_site_active?: boolean;
  ai_accepts_guest_posts?: boolean;
  ai_guidelines_summary?: string;
  ai_relevance_score?: number;
  ai_editor_name?: string;
  ai_pitch_angle?: string;
  ai_risk_flags?: string[];
  ai_contact_page?: string;
}

export interface DeepDiscoveryRequest {
  keyword: string;
  max_results?: number;
  campaign_id?: string;
}

export interface DeepDiscoveryResponse {
  keyword: string;
  source: string;
  total_found: number;
  queries?: string[];
  email_stats?: {
    total: number;
    with_email: number;
    total_emails_found: number;
    from_regex: number;
    from_contact_page: number;
    from_tavily: number;
    from_guessed: number;
  };
  opportunities: EnrichedOpportunity[];
}

// -- AI Prospecting --

export interface AiProspectOpportunityInput {
  url: string;
  domain?: string;
  page_title?: string;
  snippet?: string;
  full_text?: string;
  email?: string | null;
  contact_page?: string | null;
  quality_score?: number;
  discovery_source?: string;
}

export interface AiProspectRequest {
  keyword: string;
  opportunities: AiProspectOpportunityInput[];
}

export interface AiProspectResult {
  url: string;
  email: string | null;
  contact_page_url: string | null;
  site_active: boolean | null;
  accepts_guest_posts: boolean | null;
  guidelines_summary: string;
  relevance_score: number;
  editor_name: string;
  pitch_angle: string;
  risk_flags: string[];
  ai_prospected: boolean;
}

export interface AiProspectResponse {
  keyword: string;
  total_analyzed: number;
  total_emails_found: number;
  results: AiProspectResult[];
}

// -- Policy --

export interface SenderIdentity {
  name: string;
  email: string;
  organization: string;
  physical_mailing_address: string;
  reply_to_email?: string;
}

export interface OneClickUnsubscribe {
  enabled: boolean;
  mailto?: string;
  header_value?: string;
}

export interface BacklinkPolicyValidationRequest {
  user_id: string;
  workspace_id: string;
  campaign_id: string;
  recipient_email: string;
  recipient_domain: string;
  recipient_region: string;
  recipient_region_source: string;
  legal_basis: string;
  contact_discovery_source: string;
  consent_status: string;
  approved_by_human: boolean;
  unsubscribe_url?: string;
  one_click_unsubscribe?: OneClickUnsubscribe;
  sender_identity: SenderIdentity;
  sender_email?: string;
  idempotency_key: string;
}

export interface BacklinkPolicyValidationResponse {
  allowed: boolean;
  reasons: string[];
  final_status: string;
}

export interface BacklinkReportingSnapshot {
  send_volume: number;
  decision_events: number;
  response_rate: number;
  placement_conversion: number;
}

// -- Campaigns --

export interface BacklinkCampaignRecord {
  campaign_id: string;
  name: string;
  status: string;
  created_at?: string;
}

export interface BacklinkCampaignCreateRequest {
  workspace_id: string;
  name: string;
}

export interface BacklinkCampaignCreateResponse {
  campaign_id: string;
  name: string;
  status: string;
}

export interface BacklinkCampaignListResponse {
  campaigns: BacklinkCampaignRecord[];
}

// -- Leads --

export interface LeadRecord {
  lead_id: string;
  campaign_id: string;
  url: string | null;
  domain: string;
  page_title: string;
  snippet: string;
  email: string | null;
  confidence_score: number;
  discovery_source: string;
  status: LeadStatus;
  notes: string | null;
  created_at: string | null;
  exa_author?: string | null;
  exa_published_date?: string | null;
  exa_summary?: string | null;
  ai_editor_name?: string | null;
  ai_pitch_angle?: string | null;
  ai_guidelines_summary?: string | null;
  ai_relevance_score?: number | null;
  ai_risk_flags?: string | null;
}

export interface LeadListResponse {
  leads: LeadRecord[];
  total: number;
}

export interface LeadCreateRequest {
  campaign_id: string;
  url: string;
  domain: string;
  email?: string;
  page_title?: string;
  snippet?: string;
  confidence_score?: number;
  notes?: string;
  exa_author?: string;
  exa_published_date?: string;
  exa_summary?: string;
  ai_editor_name?: string;
  ai_pitch_angle?: string;
  ai_guidelines_summary?: string;
  ai_relevance_score?: number;
  ai_risk_flags?: string;
}

export type LeadStatus = 'discovered' | 'contacted' | 'replied' | 'placed' | 'bounced' | 'unsubscribed';

export interface LeadStatusUpdateRequest {
  status: LeadStatus;
  notes?: string;
  campaign_id?: string;
}

export interface CampaignDetailResponse {
  campaign_id: string;
  name: string;
  status: string;
  created_at: string | null;
  lead_count: number;
  leads: LeadRecord[];
}

// -- Outreach Attempts --

export interface SendOutreachRequest {
  lead_id: string;
  campaign_id: string;
  user_id: string;
  workspace_id: string;
  sender_email: string;
  subject: string;
  body: string;
  idempotency_key: string;
  sender_identity?: SenderIdentity;
  legal_basis?: string;
  contact_discovery_source?: string;
  recipient_region?: string;
  recipient_region_source?: string;
  consent_status?: string;
  approved_by_human?: boolean;
  unsubscribe_url?: string;
  one_click_unsubscribe?: OneClickUnsubscribe;
  template_id?: string;
  template_variables?: Record<string, string>;
}

export interface SendOutreachResponse {
  attempt_id: string;
  status: string;
  policy_allowed: boolean;
  policy_reasons: string[];
  effective_sender_email?: string | null;
}

export interface OutreachAttemptRecord {
  attempt_id: string;
  lead_id: string;
  campaign_id: string;
  idempotency_key: string;
  sender_email: string;
  subject: string;
  status: string;
  decision_reason: string | null;
  sent_at: string | null;
  created_at: string | null;
}

export interface OutreachAttemptListResponse {
  attempts: OutreachAttemptRecord[];
  total: number;
}

// -- Replies --

export interface OutreachReplyRecord {
  reply_id: string;
  attempt_id: string;
  from_email: string;
  subject: string;
  received_at: string | null;
  classification: string;
  body: string;
}

export interface OutreachReplyListResponse {
  replies: OutreachReplyRecord[];
  total: number;
}

// -- Follow-ups --

export interface ScheduleFollowUpRequest {
  attempt_id: string;
  scheduled_for: string;
  subject?: string;
  body?: string;
}

export interface FollowUpScheduleRecord {
  schedule_id: string;
  attempt_id: string;
  subject: string;
  scheduled_for: string | null;
  sent: boolean;
}

// -- Email Templates --

export interface EmailTemplateRequest {
  name: string;
  subject_template: string;
  body_template: string;
  variables?: string[];
}

export interface EmailTemplateRecord {
  template_id: string;
  user_id: string;
  name: string;
  subject_template: string;
  body_template: string;
  variables: string[];
  created_at: string | null;
}

export interface GenerateEmailRequest {
  topic: string;
  target_site?: string;
  tone?: 'professional' | 'friendly' | 'casual' | 'formal';
  existing_template_id?: string;
}

export interface GeneratedEmailResponse {
  subject: string;
  body: string;
}

export interface PersonalizeEmailRequest {
  lead_name: string;
  lead_site: string;
  lead_content_topic: string;
  pitch_topic: string;
  existing_body?: string;
  tone?: 'professional' | 'friendly' | 'casual' | 'formal';
  lead_summary?: string;
  lead_highlights?: string;
  lead_guidelines?: string;
  lead_pitch_angle?: string;
  lead_published_date?: string;
}

export interface SubjectLinesRequest {
  body: string;
  count?: number;
}

export interface SubjectLinesResponse {
  subjects: string[];
}

export interface FollowUpRequest {
  original_subject: string;
  original_body: string;
  days_elapsed?: number;
  reply_context?: string;
}

// -- Campaign Analytics --

export interface BulkStatusUpdateRequest {
  lead_ids: string[];
  status: LeadStatus;
  notes?: string;
  campaign_id?: string;
}

export interface BulkStatusUpdateResponse {
  updated: number;
  failed: string[];
}

export interface CampaignVolumePoint {
  date: string;
  count: number;
}

export interface CampaignVolumeResponse {
  campaign_id: string;
  days: number;
  volume: CampaignVolumePoint[];
}

export interface FunnelStage {
  status: string;
  count: number;
}

export interface ConversionFunnelResponse {
  campaign_id: string;
  stages: FunnelStage[];
}

export interface CampaignAnalyticsResponse {
  campaign_id: string;
  lead_count: number;
  send_volume: number;
  blocked_count: number;
  reply_count: number;
  response_rate: number;
  placement_rate: number;
  reply_classification: Record<string, number>;
}

// ============================================================
// API Functions
// ============================================================

// Discovery
export const fetchBacklinkModuleRegistry = async (): Promise<BacklinkModuleRegistryResponse> => (await apiClient.get('/api/backlink-outreach/modules')).data;
export const fetchBacklinkMigrationCoverage = async (): Promise<BacklinkCoverageResponse> => (await apiClient.get('/api/backlink-outreach/migration-coverage')).data;
export const fetchBacklinkQueryTemplates = async (keyword: string): Promise<BacklinkQueryTemplatesResponse> => (await apiClient.get('/api/backlink-outreach/query-templates', { params: { keyword } })).data;
export const discoverBacklinkOpportunities = async (payload: BacklinkDiscoveryRequest): Promise<BacklinkDiscoveryResponse> => (await apiClient.post('/api/backlink-outreach/discover', payload)).data;
export const discoverDeepBacklinkOpportunities = async (payload: DeepDiscoveryRequest): Promise<DeepDiscoveryResponse> => (await apiClient.post('/api/backlink-outreach/discover/deep', payload)).data;
export const aiProspectOpportunities = async (payload: AiProspectRequest): Promise<AiProspectResponse> => (await aiApiClient.post('/api/backlink-outreach/ai-prospect', payload)).data;

// Policy & Reporting
export const validateBacklinkPolicy = async (payload: BacklinkPolicyValidationRequest): Promise<BacklinkPolicyValidationResponse> => (await apiClient.post('/api/backlink-outreach/policy-validate', payload)).data;
export const fetchBacklinkReportingSnapshot = async (): Promise<BacklinkReportingSnapshot> => (await apiClient.get('/api/backlink-outreach/reporting')).data;

// Campaigns (auth handled by backend via Clerk)
export const createBacklinkCampaign = async (payload: BacklinkCampaignCreateRequest): Promise<BacklinkCampaignCreateResponse> => (await apiClient.post('/api/backlink-outreach/campaigns', payload)).data;
export const listBacklinkCampaigns = async (workspace_id: string): Promise<BacklinkCampaignListResponse> => (await apiClient.get('/api/backlink-outreach/campaigns', { params: { workspace_id } })).data;
export const fetchCampaignDetail = async (campaign_id: string): Promise<CampaignDetailResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}`)).data;
export const fetchCampaignLeads = async (campaign_id: string, status?: string): Promise<LeadListResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/leads`, { params: { status } })).data;
export const addLeadToCampaign = async (campaign_id: string, payload: LeadCreateRequest): Promise<LeadRecord> => (await apiClient.post(`/api/backlink-outreach/campaigns/${campaign_id}/leads`, payload)).data;
export const updateLeadStatus = async (lead_id: string, payload: LeadStatusUpdateRequest): Promise<LeadRecord> => (await apiClient.patch(`/api/backlink-outreach/leads/${lead_id}/status`, payload)).data;
export const bulkUpdateLeadStatus = async (payload: BulkStatusUpdateRequest): Promise<BulkStatusUpdateResponse> => (await apiClient.post('/api/backlink-outreach/leads/bulk-status', payload)).data;

// Outreach
export const sendOutreach = async (payload: SendOutreachRequest): Promise<SendOutreachResponse> => (await apiClient.post('/api/backlink-outreach/send-outreach', payload)).data;
export const fetchCampaignAttempts = async (campaign_id: string): Promise<OutreachAttemptListResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/attempts`)).data;
export const fetchCampaignReplies = async (campaign_id: string): Promise<OutreachReplyListResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/replies`)).data;
export const pollReplies = async (sent_from_email: string): Promise<{ polled: number; stored: number; replies: OutreachReplyRecord[] }> => (await apiClient.post('/api/backlink-outreach/replies/poll', null, { params: { sent_from_email } })).data;

// Follow-ups
export const scheduleFollowUp = async (campaign_id: string, payload: ScheduleFollowUpRequest): Promise<{ campaign_id: string; schedule: FollowUpScheduleRecord }> => (await apiClient.post(`/api/backlink-outreach/campaigns/${campaign_id}/schedule-followup`, payload)).data;
export const fetchFollowUps = async (campaign_id: string): Promise<{ followups: FollowUpScheduleRecord[]; total: number }> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/followups`)).data;

// Email Templates
export const createEmailTemplate = async (payload: EmailTemplateRequest): Promise<EmailTemplateRecord> => (await apiClient.post('/api/backlink-outreach/templates', payload)).data;
export const listEmailTemplates = async (): Promise<{ templates: EmailTemplateRecord[] }> => (await apiClient.get('/api/backlink-outreach/templates')).data;
export const fetchEmailTemplate = async (template_id: string): Promise<EmailTemplateRecord> => (await apiClient.get(`/api/backlink-outreach/templates/${template_id}`)).data;
export const deleteEmailTemplate = async (template_id: string): Promise<{ deleted: boolean }> => (await apiClient.delete(`/api/backlink-outreach/templates/${template_id}`)).data;
export const generateEmailTemplate = async (payload: GenerateEmailRequest): Promise<GeneratedEmailResponse> => (await aiApiClient.post('/api/backlink-outreach/templates/generate', payload)).data;
export const personalizeEmail = async (payload: PersonalizeEmailRequest): Promise<GeneratedEmailResponse> => (await aiApiClient.post('/api/backlink-outreach/generate/personalized', payload)).data;
export const generateSubjectLines = async (payload: SubjectLinesRequest): Promise<SubjectLinesResponse> => (await aiApiClient.post('/api/backlink-outreach/generate/subject-lines', payload)).data;
export const generateFollowUp = async (payload: FollowUpRequest): Promise<GeneratedEmailResponse> => (await aiApiClient.post('/api/backlink-outreach/generate/follow-up', payload)).data;

// Campaign Analytics
export const fetchCampaignAnalytics = async (campaign_id: string): Promise<CampaignAnalyticsResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/analytics`)).data;
export const fetchCampaignAnalyticsVolume = async (campaign_id: string, days: number = 30): Promise<CampaignVolumeResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/analytics/volume`, { params: { days } })).data;
export const fetchCampaignAnalyticsFunnel = async (campaign_id: string): Promise<ConversionFunnelResponse> => (await apiClient.get(`/api/backlink-outreach/campaigns/${campaign_id}/analytics/funnel`)).data;
async function csvFetch(url: string): Promise<Blob> {
  try {
    const res = await apiClient.get(url, { responseType: 'blob' });
    return res.data;
  } catch (err: any) {
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        throw new Error(json.detail || json.message || 'Export failed');
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== 'Export failed') throw parseErr;
      }
    }
    throw err;
  }
}

export const exportCampaignLeadsCsv = async (campaign_id: string): Promise<Blob> => csvFetch(`/api/backlink-outreach/campaigns/${campaign_id}/export/leads`);
export const exportCampaignAttemptsCsv = async (campaign_id: string): Promise<Blob> => csvFetch(`/api/backlink-outreach/campaigns/${campaign_id}/export/attempts`);
export const exportCampaignRepliesCsv = async (campaign_id: string): Promise<Blob> => csvFetch(`/api/backlink-outreach/campaigns/${campaign_id}/export/replies`);

// Suppression
export const fetchSuppressionList = async (): Promise<{ suppressed: any[] }> => (await apiClient.get('/api/backlink-outreach/suppression')).data;
export const addSuppression = async (email: string, reason?: string): Promise<any> => (await apiClient.post('/api/backlink-outreach/suppression', null, { params: { email, reason } })).data;
export const removeSuppression = async (id: string): Promise<any> => (await apiClient.delete(`/api/backlink-outreach/suppression/${id}`)).data;

// SMTP Config
export const fetchSmtpConfig = async (): Promise<any> => (await apiClient.get('/api/backlink-outreach/smtp-config')).data;
export const updateSmtpConfig = async (payload: any): Promise<any> => (await apiClient.put('/api/backlink-outreach/smtp-config', payload)).data;
export const deleteSmtpConfig = async (): Promise<any> => (await apiClient.delete('/api/backlink-outreach/smtp-config')).data;
