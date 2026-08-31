import { apiClient, aiApiClient } from "./client";

export type AgentTeamCatalogEntry = {
  agent_key: string;
  agent_type?: string;
  role?: string;
  responsibilities: string[];
  tools: string[];
  defaults?: {
    display_name_template?: string;
    enabled?: boolean;
    schedule?: any;
    system_prompt_template?: string;
    task_prompt_template?: string;
    rendered_system_prompt?: string;
    rendered_task_prompt_template?: string;
  };
  profile?: {
    display_name?: string | null;
    enabled?: boolean;
    schedule?: any;
    notification_prefs?: any;
    tone?: any;
    system_prompt?: string | null;
    task_prompt_template?: string | null;
    reporting_prefs?: any;
    updated_at?: string | null;
  };
};

export type AgentTeamContextSummary = {
  website_name?: string;
  website_url?: string;
  profile_name?: string;
  industry?: string;
  brand_voice?: string;
  target_audience?: string;
  content_pillars?: string[];
  competitors?: string[];
  research_depth?: string;
  content_types?: string[];
  connected_platforms?: string[];
  posting_cadence?: string;
  business_goals?: string[];
};

export type CertificationState =
  | "certified"
  | "certified_with_provider_dependency"
  | "degraded"
  | "not certified";

export type AgentCertification = {
  state?: CertificationState;
  tools_total?: number;
  tools_blocked?: number;
  missing_gates?: string[];
};

export type TeamCertification = {
  team_label?: "production-real" | "not production-real";
  default_meeting_ready?: boolean;
  summary?: Partial<Record<CertificationState, number>>;
  agents?: Record<string, AgentCertification>;
};

export async function getAgentTeam(): Promise<{
  agents: AgentTeamCatalogEntry[];
  contextSummary: AgentTeamContextSummary;
  certification: TeamCertification | null;
}> {
  const res = await apiClient.get("/api/agents/team");
  return {
    agents: res.data?.data?.agents || [],
    contextSummary: res.data?.data?.context_summary || {},
    certification: res.data?.data?.certification || null,
  };
}

export async function saveAgentProfile(agentKey: string, payload: Record<string, any>) {
  const res = await apiClient.post(`/api/agents/team/${encodeURIComponent(agentKey)}`, payload);
  return res.data?.data?.profile;
}

export async function previewAgentProfile(
  agentKey: string,
  contextCard: Record<string, any>,
  draft?: { system_prompt?: string; task_prompt_template?: string }
) {
  const res = await aiApiClient.post(`/api/agents/team/${encodeURIComponent(agentKey)}/preview`, {
    context_card: contextCard,
    system_prompt: draft?.system_prompt,
    task_prompt_template: draft?.task_prompt_template,
  });
  return res.data?.data?.preview;
}

