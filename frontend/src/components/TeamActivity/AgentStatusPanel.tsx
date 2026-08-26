import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { AgentEventItem, AgentRunItem, AgentAlertItem } from '../../hooks/useAgentHuddleFeed';

interface CommitteeProposal {
  agent: string;
  title: string;
  pillar_id: string;
  priority: string;
  valid: boolean;
  accepted: boolean;
  reasoning?: string;
  rejected_reason?: string | null;
  estimated_time?: number;
  action_type?: string;
}

interface CommitteePayload {
  agents_polled: number;
  total_proposals: number;
  accepted_count: number;
  rejected_count: number;
  proposals: CommitteeProposal[];
}

// Agent type mapping: source_agent → agent_type for run cross-ref
const AGENT_TYPE_MAP: Record<string, string> = {
  ContentStrategyAgent: 'content_strategist',
  StrategyArchitectAgent: 'strategy_architect',
  SEOOptimizationAgent: 'seo_specialist',
  SocialAmplificationAgent: 'social_media_manager',
  CompetitorResponseAgent: 'competitor_analyst',
  ContentGapRadarAgent: 'content_gap_radar',
};

const AGENT_INFO: Record<string, { label: string; short: string; desc: string }> = {
  ContentStrategyAgent: { label: 'Content Strategy', short: 'Strategy', desc: 'Content planning based on your pillars & topics' },
  StrategyArchitectAgent: { label: 'Strategy Architect', short: 'Architect', desc: 'Semantic gap discovery from your content index' },
  SEOOptimizationAgent: { label: 'SEO Optimization', short: 'SEO', desc: 'Technical SEO, keywords & performance' },
  SocialAmplificationAgent: { label: 'Social Amplification', short: 'Social', desc: 'Social media distribution & engagement' },
  CompetitorResponseAgent: { label: 'Competitor Response', short: 'Competitor', desc: 'Competitor content monitoring & response' },
  ContentGapRadarAgent: { label: 'Content Gap Radar', short: 'Gap Radar', desc: 'ROI-ranked content gap opportunities' },
};

type AgentHealth = 'good' | 'warning' | 'error' | 'inactive';

interface AgentStatus {
  sourceName: string;    // class name (from proposals)
  agentType: string;     // agent_type value (from runs)
  label: string;
  short: string;
  desc: string;
  health: AgentHealth;
  healthReason: string;
  // From committee
  totalProposals: number;
  acceptedProposals: number;
  proposals: CommitteeProposal[];
  // From runs
  latestRun: AgentRunItem | null;
  // From alerts
  alertCount: number;
}

const healthIcon = (h: AgentHealth) => {
  if (h === 'good') return <CheckCircleIcon sx={{ fontSize: 20, color: '#4caf50' }} />;
  if (h === 'warning') return <WarningAmberIcon sx={{ fontSize: 20, color: '#ff9800' }} />;
  return <ErrorIcon sx={{ fontSize: 20, color: '#f44336' }} />;
};

const healthColor = (h: AgentHealth) => {
  if (h === 'good') return '#4caf50';
  if (h === 'warning') return '#ff9800';
  return '#f44336';
};

// ─── Agent Card ────────────────────────────────────
const AgentCard: React.FC<{
  status: AgentStatus;
  expanded: boolean;
  onToggle: () => void;
  latestRuns: AgentRunItem[];
}> = ({ status, expanded, onToggle, latestRuns }) => {
  const color = healthColor(status.health);
  const pct = status.totalProposals > 0 ? (status.acceptedProposals / status.totalProposals) * 100 : 0;

  return (
    <Box>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 1.25,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: `1px solid ${color}22`,
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: `${color}44` },
        }}
      >
        {healthIcon(status.health)}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
            {status.label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
            {status.totalProposals > 0 && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                {status.acceptedProposals}/{status.totalProposals} proposals
              </Typography>
            )}
            {status.alertCount > 0 && (
              <Chip
                label={`${status.alertCount} alert${status.alertCount > 1 ? 's' : ''}`}
                size="small"
                sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(244,67,54,0.15)', color: '#f44336' }}
              />
            )}
            {status.latestRun && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <ScheduleIcon sx={{ fontSize: 10 }} />
                {timeAgo(status.latestRun.finished_at || status.latestRun.started_at)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Mini bar for proposal acceptance */}
        {status.totalProposals > 0 && (
          <Box sx={{ width: 40 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: color },
              }}
            />
          </Box>
        )}

        {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />}
      </Box>

      {/* Expanded details */}
      <Collapse in={expanded}>
        <Box sx={{ pl: 1.5, pr: 1.5, pb: 1, pt: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, mb: 0.5, display: 'block' }}>
            {status.desc}
          </Typography>

          {/* Proposals from this agent */}
          {status.proposals.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Proposals
              </Typography>
              {status.proposals.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3, px: 1, borderRadius: 1, bgcolor: p.accepted ? 'rgba(76,175,80,0.06)' : 'transparent' }}>
                  <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    {p.title}
                  </Typography>
                  <Chip label={p.pillar_id} size="small" sx={{
                    height: 18, fontSize: 9, fontWeight: 600,
                    bgcolor: p.valid ? 'rgba(102,126,234,0.15)' : 'rgba(244,67,54,0.15)',
                    color: p.valid ? '#8b9cf7' : '#f44336',
                  }} />
                  <Chip label={p.priority} size="small" sx={{
                    height: 18, fontSize: 9, fontWeight: 600, textTransform: 'capitalize',
                    bgcolor: p.priority === 'high' ? 'rgba(76,175,80,0.15)' : p.priority === 'medium' ? 'rgba(255,152,0,0.15)' : 'rgba(158,158,158,0.15)',
                    color: p.priority === 'high' ? '#4caf50' : p.priority === 'medium' ? '#ff9800' : '#9e9e9e',
                  }} />
                  <Chip label={p.accepted ? '✓' : '—'} size="small" sx={{
                    height: 18, fontSize: 9, fontWeight: 700,
                    bgcolor: p.accepted ? 'rgba(76,175,80,0.15)' : 'rgba(158,158,158,0.15)',
                    color: p.accepted ? '#4caf50' : '#9e9e9e',
                  }} />
                </Box>
              ))}
            </Box>
          )}

          {/* Latest runs */}
          {latestRuns.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Recent Runs
              </Typography>
              {latestRuns.slice(0, 3).map((run) => (
                <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.3, px: 1 }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    bgcolor: run.status === 'completed' || run.success ? '#4caf50' : run.status === 'error' || run.success === false ? '#f44336' : '#ff9800',
                  }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, flex: 1 }}>
                    {run.status || 'running'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                    {timeAgo(run.finished_at || run.started_at)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Main Component ─────────────────────────────────
const AgentStatusPanel: React.FC<{
  events: AgentEventItem[];
  runs: AgentRunItem[];
  alerts: AgentAlertItem[];
}> = ({ events, runs, alerts }) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const agents = useMemo<AgentStatus[]>(() => {
    // Parse committee meeting data
    const meeting = events.find((e) => e.event_type === 'committee_meeting');
    const payload = meeting?.payload
      ? (typeof meeting.payload === 'string' ? JSON.parse(meeting.payload) : meeting.payload) as CommitteePayload
      : null;

    // Group proposals by agent
    const proposalMap = new Map<string, CommitteeProposal[]>();
    if (payload) {
      for (const p of payload.proposals) {
        if (!proposalMap.has(p.agent)) proposalMap.set(p.agent, []);
        proposalMap.get(p.agent)!.push(p);
      }
    }

    // Build agent status list from known agents
    const agentKeys = Object.keys(AGENT_INFO);
    const result: AgentStatus[] = [];

    for (const sourceName of agentKeys) {
      const info = AGENT_INFO[sourceName];
      const agentType = AGENT_TYPE_MAP[sourceName];
      const proposals = proposalMap.get(sourceName) || [];

      // Proposals stats
      const totalProposals = proposals.length;
      const acceptedProposals = proposals.filter((p) => p.accepted).length;

      // Latest run
      const agentRuns = runs.filter((r) => r.agent_type === agentType);
      const latestRun = agentRuns.length > 0 ? agentRuns[0] : null;

      // Alerts
      const alertCount = alerts.filter((a) => a.title && a.title.includes(info.short)).length;

      // Determine health
      let health: AgentHealth = 'good';
      let healthReason = 'All systems good';

      if (latestRun?.status === 'error' || latestRun?.success === false) {
        health = 'error';
        healthReason = 'Latest run failed';
      } else if (alertCount > 0) {
        health = 'warning';
        healthReason = `${alertCount} alert${alertCount > 1 ? 's' : ''}`;
      } else if (totalProposals > 0 && acceptedProposals === 0) {
        health = 'warning';
        healthReason = 'All proposals rejected';
      } else if (totalProposals > 0 && acceptedProposals < totalProposals) {
        health = 'warning';
        healthReason = `${totalProposals - acceptedProposals} proposal${totalProposals - acceptedProposals > 1 ? 's' : ''} not adopted`;
      }

      result.push({
        sourceName,
        agentType,
        ...info,
        health,
        healthReason,
        totalProposals,
        acceptedProposals,
        proposals,
        latestRun,
        alertCount,
      });
    }

    // Sort: error first, then warning, then good, then inactive
    const healthRank = { error: 0, warning: 1, good: 2, inactive: 3 };
    result.sort((a, b) => healthRank[a.health] - healthRank[b.health]);

    return result;
  }, [events, runs, alerts]);

  return (
    <Box
      sx={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 3.5,
        boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
        p: 2.5,
        mb: 2,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
        Agent Status
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
        {agents.map((agent) => (
          <AgentCard
            key={agent.sourceName}
            status={agent}
            expanded={expandedAgent === agent.sourceName}
            onToggle={() => setExpandedAgent(expandedAgent === agent.sourceName ? null : agent.sourceName)}
            latestRuns={runs.filter((r) => r.agent_type === agent.agentType)}
          />
        ))}
      </Box>
    </Box>
  );
};

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default AgentStatusPanel;
