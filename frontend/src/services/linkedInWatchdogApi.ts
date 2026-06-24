import { apiClient } from '../api/client';

// ── TypeScript models matching backend Pydantic models ──────────────

export interface WatchdogIndustry {
  id: string;
  user_id: string;
  name: string;
  search_queries: string[];
  created_at: string;
  updated_at: string;
}

export interface WatchdogCompany {
  id: string;
  user_id: string;
  name: string;
  url?: string;
  industry_tag?: string;
  search_queries: string[];
  created_at: string;
  updated_at: string;
}

export interface WatchdogPerson {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  search_queries: string[];
  created_at: string;
  updated_at: string;
}

export interface WatchdogUpdate {
  id: string;
  user_id: string;
  category: 'industry' | 'company' | 'person';
  reference_id: string;
  reference_name: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  published_date?: string;
  is_read: boolean;
  created_at: string;
}

// ── Request interfaces ─────────────────────────────────────────────

export interface WatchdogIndustryCreate {
  name: string;
  search_queries?: string[];
}

export interface WatchdogIndustryUpdate {
  name?: string;
  search_queries?: string[];
}

export interface WatchdogCompanyCreate {
  name: string;
  url?: string;
  industry_tag?: string;
  search_queries?: string[];
}

export interface WatchdogCompanyUpdate {
  name?: string;
  url?: string;
  industry_tag?: string;
  search_queries?: string[];
}

export interface WatchdogPersonCreate {
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  search_queries?: string[];
}

export interface WatchdogPersonUpdate {
  name?: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  search_queries?: string[];
}

// ── Response interfaces ────────────────────────────────────────────

export interface WatchdogListResponse {
  success: boolean;
  industries: WatchdogIndustry[];
  companies: WatchdogCompany[];
  people: WatchdogPerson[];
}

export interface WatchdogUpdatesResponse {
  success: boolean;
  updates: WatchdogUpdate[];
  total_count: number;
  unread_count: number;
}

export interface WatchdogRefreshResponse {
  success: boolean;
  new_updates: number;
  total_updates: number;
  message: string;
}

export interface WatchdogDiscoverResponse {
  success: boolean;
  results: Record<string, any>[];
}

export interface WatchdogDiscoverRequest {
  query: string;
  num_results?: number;
}

// ── Generic CRUD response helpers ──────────────────────────────────

interface SingleItemResponse<T> {
  success: boolean;
  [key: string]: any;
}

// ── API service ────────────────────────────────────────────────────

const BASE = '/api/linkedin/watchdog';

export const linkedInWatchdogApi = {

  // ── All ────────────────────────────────────────────────────────

  async getAll(): Promise<WatchdogListResponse> {
    const { data } = await apiClient.get(`${BASE}/all`);
    return data;
  },

  // ── Industries ─────────────────────────────────────────────────

  async getIndustries(): Promise<{ success: boolean; industries: WatchdogIndustry[] }> {
    const { data } = await apiClient.get(`${BASE}/industries`);
    return data;
  },

  async createIndustry(req: WatchdogIndustryCreate): Promise<{ success: boolean; industry: WatchdogIndustry }> {
    const { data } = await apiClient.post(`${BASE}/industries`, req);
    return data;
  },

  async updateIndustry(id: string, req: WatchdogIndustryUpdate): Promise<{ success: boolean; industry: WatchdogIndustry }> {
    const { data } = await apiClient.put(`${BASE}/industries/${id}`, req);
    return data;
  },

  async deleteIndustry(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`${BASE}/industries/${id}`);
    return data;
  },

  // ── Companies ──────────────────────────────────────────────────

  async getCompanies(): Promise<{ success: boolean; companies: WatchdogCompany[] }> {
    const { data } = await apiClient.get(`${BASE}/companies`);
    return data;
  },

  async createCompany(req: WatchdogCompanyCreate): Promise<{ success: boolean; company: WatchdogCompany }> {
    const { data } = await apiClient.post(`${BASE}/companies`, req);
    return data;
  },

  async updateCompany(id: string, req: WatchdogCompanyUpdate): Promise<{ success: boolean; company: WatchdogCompany }> {
    const { data } = await apiClient.put(`${BASE}/companies/${id}`, req);
    return data;
  },

  async deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`${BASE}/companies/${id}`);
    return data;
  },

  // ── People ─────────────────────────────────────────────────────

  async getPeople(): Promise<{ success: boolean; people: WatchdogPerson[] }> {
    const { data } = await apiClient.get(`${BASE}/people`);
    return data;
  },

  async createPerson(req: WatchdogPersonCreate): Promise<{ success: boolean; person: WatchdogPerson }> {
    const { data } = await apiClient.post(`${BASE}/people`, req);
    return data;
  },

  async updatePerson(id: string, req: WatchdogPersonUpdate): Promise<{ success: boolean; person: WatchdogPerson }> {
    const { data } = await apiClient.put(`${BASE}/people/${id}`, req);
    return data;
  },

  async deletePerson(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`${BASE}/people/${id}`);
    return data;
  },

  // ── Discovery ──────────────────────────────────────────────────

  async discoverCompanies(req: WatchdogDiscoverRequest): Promise<WatchdogDiscoverResponse> {
    const { data } = await apiClient.post(`${BASE}/discover/companies`, req);
    return data;
  },

  async discoverPeople(req: WatchdogDiscoverRequest): Promise<WatchdogDiscoverResponse> {
    const { data } = await apiClient.post(`${BASE}/discover/people`, req);
    return data;
  },

  // ── Refresh ────────────────────────────────────────────────────

  async refresh(): Promise<WatchdogRefreshResponse> {
    const { data } = await apiClient.post(`${BASE}/refresh`);
    return data;
  },

  // ── Updates ────────────────────────────────────────────────────

  async getUpdates(params?: { category?: string; since?: string }): Promise<WatchdogUpdatesResponse> {
    const { data } = await apiClient.get(`${BASE}/updates`, { params });
    return data;
  },

  async markUpdateRead(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.put(`${BASE}/updates/${id}/read`);
    return data;
  },

  // ── Exa Monitors ────────────────────────────────────────────────

  async syncMonitors(): Promise<{ success: boolean; message: string; created: Record<string, number> }> {
    const { data } = await apiClient.post(`${BASE}/sync-monitors`);
    return data;
  },

  async triggerMonitors(): Promise<{ success: boolean; triggered: number }> {
    const { data } = await apiClient.post(`${BASE}/trigger-monitors`);
    return data;
  },

  async getMonitorStatus(): Promise<{ success: boolean; monitors: MonitorStatus[] }> {
    const { data } = await apiClient.get(`${BASE}/monitor-status`);
    return data;
  },
};

export interface MonitorStatus {
  id: string;
  exa_monitor_id: string;
  category: 'industry' | 'company' | 'person';
  reference_id: string;
  status: string;
  last_run_at: string | null;
  created_at: string | null;
}
