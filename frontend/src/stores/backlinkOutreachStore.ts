import { create } from 'zustand';

import {
  AiProspectResult,
  BacklinkCampaignRecord,
  BacklinkCoverageResponse,
  BacklinkModuleRecord,
  CampaignDetailResponse,
  CampaignAnalyticsResponse,
  createBacklinkCampaign,
  discoverDeepBacklinkOpportunities,
  EnrichedOpportunity,
  fetchBacklinkMigrationCoverage,
  fetchBacklinkModuleRegistry,
  fetchCampaignDetail,
  fetchCampaignAnalytics,
  FollowUpScheduleRecord,
  LeadRecord,
  listBacklinkCampaigns,
  sendOutreach,
  SendOutreachRequest,
  SendOutreachResponse,
  OutreachAttemptRecord,
  fetchCampaignAttempts,
  OutreachReplyRecord,
  fetchCampaignReplies,
  fetchFollowUps as apiFetchFollowUps,
  fetchSuppressionList,
  addSuppression,
  removeSuppression,
  aiProspectOpportunities,
} from '../api/backlinkOutreachApi';

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt < retries && (!err?.response || err.response.status >= 500)) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

interface BacklinkOutreachStore {
  modules: BacklinkModuleRecord[];
  coverage: BacklinkCoverageResponse | null;
  campaigns: BacklinkCampaignRecord[];
  selectedCampaign: CampaignDetailResponse | null;
  discoveredOpportunities: EnrichedOpportunity[];
  discoveryQueries: string[];
  discoveryEmailStats: { total: number; with_email: number; total_emails_found: number; from_regex: number; from_contact_page: number; from_tavily: number; from_guessed: number } | null;
  leads: LeadRecord[];
  attempts: OutreachAttemptRecord[];
  replies: OutreachReplyRecord[];
  followups: FollowUpScheduleRecord[];
  analytics: CampaignAnalyticsResponse | null;
  isLoading: boolean;
  isDiscovering: boolean;
  isAiProspecting: boolean;
  aiProspectResults: AiProspectResult[];
  isAttemptsLoading: boolean;
  isRepliesLoading: boolean;
  isAnalyticsLoading: boolean;
  error: string | null;
  suppressedList: { id: string; email: string; domain: string; reason: string; created_at: string }[];
  refreshBacklinkRegistry: () => Promise<void>;
  fetchCampaigns: (workspaceId: string) => Promise<void>;
  createCampaign: (workspaceId: string, name: string) => Promise<string | null>;
  selectCampaign: (campaignId: string) => Promise<void>;
  deepDiscover: (keyword: string, maxResults?: number, campaignId?: string) => Promise<EnrichedOpportunity[]>;
  clearDiscoveries: () => void;
  runAiProspect: (keyword: string) => Promise<void>;
  clearAiProspect: () => void;
  sendOutreachEmail: (req: SendOutreachRequest) => Promise<SendOutreachResponse | null>;
  fetchAttempts: (campaignId: string) => Promise<void>;
  fetchReplies: (campaignId: string) => Promise<void>;
  fetchFollowUps: (campaignId: string) => Promise<void>;
  fetchAnalytics: (campaignId: string) => Promise<void>;
  fetchSuppressedList: () => Promise<void>;
  addSuppressedRecipient: (email: string, reason?: string) => Promise<void>;
  removeSuppressedRecipient: (id: string) => Promise<void>;
}

export const useBacklinkOutreachStore = create<BacklinkOutreachStore>((set) => ({
  modules: [],
  coverage: null,
  campaigns: [],
  selectedCampaign: null,
  discoveredOpportunities: [],
  discoveryQueries: [],
  discoveryEmailStats: null,
  leads: [],
  attempts: [],
  replies: [],
  followups: [],
  analytics: null,
  isLoading: false,
  isDiscovering: false,
  isAiProspecting: false,
  aiProspectResults: [],
  isAttemptsLoading: false,
  isRepliesLoading: false,
  isAnalyticsLoading: false,
  error: null,
  suppressedList: [],
  refreshBacklinkRegistry: async () => {
    set({ isLoading: true, error: null });
    try {
      const [registryPayload, coveragePayload] = await Promise.all([
        fetchBacklinkModuleRegistry(),
        fetchBacklinkMigrationCoverage(),
      ]);
      set({ modules: registryPayload.modules, coverage: coveragePayload, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message ?? 'Failed to load backlink module registry',
      });
    }
  },
  fetchCampaigns: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await withRetry(() => listBacklinkCampaigns(workspaceId));
      set({ campaigns: response.campaigns, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message ?? 'Failed to load campaigns',
      });
    }
  },
  createCampaign: async (workspaceId: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await createBacklinkCampaign({ workspace_id: workspaceId, name });
      set((state) => ({
        campaigns: [...state.campaigns, { campaign_id: result.campaign_id, name: result.name, status: result.status }],
        isLoading: false,
      }));
      return result.campaign_id;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message ?? 'Failed to create campaign',
      });
      return null;
    }
  },
  selectCampaign: async (campaignId: string) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await withRetry(() => fetchCampaignDetail(campaignId));
      set({ selectedCampaign: detail, leads: detail.leads, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message ?? 'Failed to load campaign',
      });
    }
  },
  deepDiscover: async (keyword: string, maxResults?: number, campaignId?: string) => {
    set({ isDiscovering: true, error: null });
    try {
      const result = await discoverDeepBacklinkOpportunities({ keyword, max_results: maxResults, campaign_id: campaignId });
      set({
        discoveredOpportunities: result.opportunities,
        discoveryQueries: result.queries ?? [],
        discoveryEmailStats: result.email_stats ?? null,
        isDiscovering: false,
      });
      return result.opportunities;
    } catch (error: any) {
      set({
        isDiscovering: false,
        error: error?.message ?? 'Failed to discover opportunities',
      });
      return [];
    }
  },
  clearDiscoveries: () => set({ discoveredOpportunities: [], discoveryQueries: [], discoveryEmailStats: null, aiProspectResults: [] }),
  clearAiProspect: () => set({ aiProspectResults: [] }),
  runAiProspect: async (keyword: string) => {
    const snapshot = useBacklinkOutreachStore.getState();
    if (snapshot.discoveredOpportunities.length === 0) {
      set({ isAiProspecting: false, error: 'No opportunities to analyze' });
      return;
    }
    set({ isAiProspecting: true, error: null });
    try {
      const state = useBacklinkOutreachStore.getState();
      const opportunities = state.discoveredOpportunities.map((opp) => ({
        url: opp.url,
        domain: opp.domain,
        page_title: opp.page_title,
        snippet: opp.snippet,
        full_text: opp.full_text,
        email: opp.email,
        contact_page: opp.contact_page,
        quality_score: opp.quality_score,
        discovery_source: opp.discovery_source,
      }));
      const result = await aiProspectOpportunities({ keyword, opportunities });
      set({
        aiProspectResults: result.results,
        discoveredOpportunities: state.discoveredOpportunities.map((opp) => {
          const enriched = result.results.find((r) => r.url === opp.url);
          if (!enriched) return opp;
          return {
            ...opp,
            email: enriched.email || opp.email,
            ai_site_active: enriched.site_active ?? undefined,
            ai_accepts_guest_posts: enriched.accepts_guest_posts ?? undefined,
            ai_guidelines_summary: enriched.guidelines_summary,
            ai_relevance_score: enriched.relevance_score,
            ai_editor_name: enriched.editor_name,
            ai_pitch_angle: enriched.pitch_angle,
            ai_risk_flags: enriched.risk_flags,
            ai_contact_page: enriched.contact_page_url ?? undefined,
            ai_prospected: true,
          } as EnrichedOpportunity;
        }),
        isAiProspecting: false,
      });
    } catch (error: any) {
      set({
        isAiProspecting: false,
        error: error?.message ?? 'AI prospecting failed',
      });
    }
  },
  sendOutreachEmail: async (req: SendOutreachRequest) => {
    set({ isLoading: true, error: null });
    try {
      const result = await sendOutreach(req);
      set({ isLoading: false });
      return result;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error?.message ?? 'Failed to send outreach',
      });
      return null;
    }
  },
  fetchAttempts: async (campaignId: string) => {
    set({ isAttemptsLoading: true, error: null });
    try {
      const result = await withRetry(() => fetchCampaignAttempts(campaignId));
      set({ attempts: result.attempts, isAttemptsLoading: false });
    } catch (error: any) {
      set({
        isAttemptsLoading: false,
        error: error?.message ?? 'Failed to load attempts',
      });
    }
  },
  fetchReplies: async (campaignId: string) => {
    set({ isRepliesLoading: true, error: null });
    try {
      const result = await withRetry(() => fetchCampaignReplies(campaignId));
      set({ replies: result.replies, isRepliesLoading: false });
    } catch (error: any) {
      set({
        isRepliesLoading: false,
        error: error?.message ?? 'Failed to load replies',
      });
    }
  },
  fetchFollowUps: async (campaignId: string) => {
    set({ error: null });
    try {
      const result = await withRetry(() => apiFetchFollowUps(campaignId));
      set({ followups: result.followups });
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to load follow-ups' });
    }
  },
  fetchAnalytics: async (campaignId: string) => {
    set({ isAnalyticsLoading: true, error: null });
    try {
      const result = await withRetry(() => fetchCampaignAnalytics(campaignId));
      set({ analytics: result, isAnalyticsLoading: false });
    } catch (error: any) {
      set({
        isAnalyticsLoading: false,
        error: error?.message ?? 'Failed to load analytics',
      });
    }
  },
  fetchSuppressedList: async () => {
    try {
      const result = await fetchSuppressionList();
      set({ suppressedList: result.suppressed });
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to load suppression list' });
    }
  },
  addSuppressedRecipient: async (email: string, reason?: string) => {
    try {
      await addSuppression(email, reason);
      const result = await fetchSuppressionList();
      set({ suppressedList: result.suppressed });
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to add suppression' });
    }
  },
  removeSuppressedRecipient: async (id: string) => {
    try {
      await removeSuppression(id);
      set((state) => ({
        suppressedList: state.suppressedList.filter((s) => s.id !== id),
      }));
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to remove suppression' });
    }
  },
}));