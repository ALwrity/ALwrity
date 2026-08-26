import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Collapse,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { AgentEventItem } from '../../hooks/useAgentHuddleFeed';

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

const PILLAR_ORDER = ['plan', 'generate', 'publish', 'analyze', 'engage', 'remarket'];
const PILLAR_INFO: Record<string, { label: string; short: string; desc: string }> = {
  plan:      { label: 'Plan',     short: 'Plan',    desc: 'Strategy & planning' },
  generate:  { label: 'Generate', short: 'Create',  desc: 'Content creation' },
  publish:   { label: 'Publish',  short: 'Pub.',   desc: 'Publishing & scheduling' },
  analyze:   { label: 'Analyze',  short: 'Audit',   desc: 'Performance review' },
  engage:    { label: 'Engage',   short: 'Share',   desc: 'Social engagement' },
  remarket:  { label: 'Remarket', short: 'ReMkt',   desc: 'Repurpose & promote' },
};

// ─── Status Banner ──────────────────────────────────
const statusMeta = (accepted: number, total: number) => {
  const pct = total > 0 ? accepted / total : 0;
  if (pct >= 0.8) return { color: '#4caf50', bg: 'rgba(76,175,80,0.12)', icon: <CheckCircleIcon sx={{ fontSize: 20, color: '#4caf50' }} />, text: 'All systems good' };
  if (pct >= 0.5) return { color: '#ff9800', bg: 'rgba(255,152,0,0.12)', icon: <WarningAmberIcon sx={{ fontSize: 20, color: '#ff9800' }} />, text: 'Needs review' };
  return { color: '#f44336', bg: 'rgba(244,67,54,0.12)', icon: <ErrorIcon sx={{ fontSize: 20, color: '#f44336' }} />, text: 'Attention needed' };
};

const StatusBanner: React.FC<{ accepted: number; total: number; agents: number }> = ({ accepted, total, agents }) => {
  const meta = statusMeta(accepted, total);
  const pct = total > 0 ? Math.round(accepted / total * 100) : 0;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: meta.bg,
        mb: 1.5,
      }}
    >
      {meta.icon}
      <Typography variant="body2" sx={{ color: meta.color, fontWeight: 600, flex: 1 }}>
        {meta.text} — <Box component="span" sx={{ fontWeight: 400 }}>{accepted} of {total} proposals adopted from {agents} areas</Box>
      </Typography>
      <Typography variant="h6" sx={{ color: meta.color, fontWeight: 800, fontSize: '1.1rem' }}>
        {pct}%
      </Typography>
    </Box>
  );
};

// ─── Adoption Bar ───────────────────────────────────
const AdoptionBar: React.FC<{ accepted: number; total: number }> = ({ accepted, total }) => {
  const pct = total > 0 ? accepted / total * 100 : 0;
  const color = pct >= 80 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#f44336';
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
          Adoption
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
          Adopted <Box component="span" sx={{ color }}>{accepted}</Box> of {total} proposals
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, rgba(102,126,234,0.8), ${color})`,
            borderRadius: 4,
          },
        }}
      />
    </Box>
  );
};

// ─── Coverage Flow ──────────────────────────────────
const coverageHealth = (count: number): { color: string; label: string; dot: string } => {
  if (count >= 3) return { color: '#4caf50', label: 'covered', dot: '●' };
  if (count >= 1) return { color: '#ff9800', label: 'light', dot: '◕' };
  return { color: '#f44336', label: 'missing', dot: '○' };
};

const CoverageFlow: React.FC<{ proposals: CommitteeProposal[] }> = ({ proposals }) => {
  const counts = PILLAR_ORDER.map((p) => ({
    ...PILLAR_INFO[p],
    key: p,
    count: proposals.filter((pr) => pr.pillar_id === p).length,
  }));

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
        Today's Coverage
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', overflow: 'auto', pb: 0.5 }}>
        {counts.map((p, i) => {
          const health = coverageHealth(p.count);
          return (
            <React.Fragment key={p.key}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                  minWidth: 56,
                  py: 1,
                  px: 0.75,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${health.color}22`,
                }}
              >
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 11, lineHeight: 1.2 }}>
                  {p.short}
                </Typography>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>
                  {p.count}
                </Typography>
                <Typography variant="caption" sx={{ color: health.color, fontSize: 9, fontWeight: 600 }}>
                  {health.label}
                </Typography>
              </Box>
              {i < counts.length - 1 && (
                <ArrowForwardIcon sx={{ mx: 0.25, color: 'rgba(255,255,255,0.15)', fontSize: 16, flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

// ─── Rejected List (redesigned) ─────────────────────
const plainReason = (p: CommitteeProposal): string => {
  if (p.rejected_reason) return p.rejected_reason;
  if (!p.valid) return `"${p.pillar_id}" isn't a valid workflow phase — this is a system configuration issue.`;
  return 'This suggestion was similar to an existing task or had lower priority.';
};

const actionForProposal = (p: CommitteeProposal): { label: string; icon?: React.ReactNode } | null => {
  const title = p.title.toLowerCase();
  if (title.includes('twitter') || title.includes('tweet')) {
    return { label: 'Connect Twitter' };
  }
  if (title.includes('linkedin')) {
    return { label: 'Connect LinkedIn' };
  }
  if (title.includes('facebook') || title.includes('instagram')) {
    return { label: 'Connect Social' };
  }
  return null;
};

const RejectedList: React.FC<{ proposals: CommitteeProposal[] }> = ({ proposals }) => {
  const rejected = proposals.filter((p) => !p.accepted);
  const [open, setOpen] = useState(false);

  if (rejected.length === 0) return null;

  return (
    <Box sx={{ pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          py: 0.5,
          borderRadius: 1,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        <Chip
          label={rejected.length}
          size="small"
          sx={{
            height: 20,
            minWidth: 20,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: 'rgba(244,67,54,0.2)',
            color: '#f44336',
          }}
        />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
          suggestion{rejected.length > 1 ? 's' : ''} not included
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', mr: 0.5 }}>
            {open ? 'hide' : 'view'}
          </Typography>
          {open ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />}
        </Box>
      </Box>

      <Collapse in={open}>
        <Box sx={{ pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {rejected.map((p, i) => {
            const action = actionForProposal(p);
            return (
              <Box
                key={i}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <InfoIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', mt: 0.25, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, mb: 0.25 }}>
                      &ldquo;{p.title}&rdquo;
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', lineHeight: 1.4 }}>
                      {plainReason(p)}
                    </Typography>
                    {action && (
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          mt: 0.75,
                          height: 24,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'none',
                          color: '#8b9cf7',
                          borderColor: 'rgba(102,126,234,0.3)',
                          '&:hover': { borderColor: 'rgba(102,126,234,0.6)', bgcolor: 'rgba(102,126,234,0.1)' },
                        }}
                      >
                        {action.label}
                      </Button>
                    )}
                  </Box>
                  <Chip
                    label={p.agent}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 9,
                      fontWeight: 600,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.4)',
                      flexShrink: 0,
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Agent Row (details section) ────────────────────
type AgentStatus = 'all_accepted' | 'partial' | 'all_rejected';
interface AgentSummary {
  name: string;
  total: number;
  accepted: number;
  status: AgentStatus;
  proposals: CommitteeProposal[];
}

const agentStatusIcon = (s: AgentStatus) => {
  if (s === 'all_accepted') return <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />;
  if (s === 'partial') return <WarningAmberIcon sx={{ fontSize: 18, color: '#ff9800' }} />;
  return <ErrorIcon sx={{ fontSize: 18, color: '#f44336' }} />;
};

const agentStatusColor = (s: AgentStatus): 'success' | 'warning' | 'error' => {
  if (s === 'all_accepted') return 'success';
  if (s === 'partial') return 'warning';
  return 'error';
};

const AgentRow: React.FC<{ agent: AgentSummary; expanded: boolean; onToggle: () => void }> = ({ agent, expanded, onToggle }) => {
  const pct = agent.total > 0 ? agent.accepted / agent.total : 0;
  return (
    <Box>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, px: 1.5, borderRadius: 2,
          cursor: 'pointer', transition: 'background 0.2s',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        {agentStatusIcon(agent.status)}
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 140, color: 'rgba(255,255,255,0.9)' }}>
          {agent.name}
        </Typography>
        <Box sx={{ flex: 1, maxWidth: 140 }}>
          <LinearProgress
            variant="determinate"
            value={pct * 100}
            color={agentStatusColor(agent.status)}
            sx={{ height: 5, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.08)' }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'right' }}>
          {agent.accepted}/{agent.total}
        </Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ ml: 5, mr: 1.5, mb: 0.5 }}>
          {agent.proposals.map((p, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.35, px: 1, borderRadius: 1, bgcolor: p.accepted ? 'rgba(76,175,80,0.06)' : 'transparent' }}>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.8)' }}>
                {p.title}
              </Typography>
              <Chip label={PILLAR_INFO[p.pillar_id]?.label || p.pillar_id} size="small" sx={{
                height: 20, fontSize: 10, fontWeight: 600,
                bgcolor: p.valid ? 'rgba(102,126,234,0.2)' : 'rgba(244,67,54,0.2)',
                color: p.valid ? '#8b9cf7' : '#f44336',
                border: `1px solid ${p.valid ? 'rgba(102,126,234,0.3)' : 'rgba(244,67,54,0.3)'}`,
              }} />
              <Chip label={p.priority} size="small" sx={{
                height: 20, fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                bgcolor: p.priority === 'high' ? 'rgba(76,175,80,0.15)' : p.priority === 'medium' ? 'rgba(255,152,0,0.15)' : 'rgba(158,158,158,0.15)',
                color: p.priority === 'high' ? '#4caf50' : p.priority === 'medium' ? '#ff9800' : '#9e9e9e',
              }} />
              <Chip label={p.accepted ? 'Accepted' : 'Skipped'} size="small" sx={{
                height: 20, fontSize: 10, fontWeight: 600,
                bgcolor: p.accepted ? 'rgba(76,175,80,0.15)' : 'rgba(158,158,158,0.15)',
                color: p.accepted ? '#4caf50' : '#9e9e9e',
              }} />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Main Component ─────────────────────────────────
const CommitteeSummary: React.FC<{ events: AgentEventItem[] }> = ({ events }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const meeting = useMemo<CommitteePayload | null>(() => {
    const last = events.find((e) => e.event_type === 'committee_meeting');
    if (!last?.payload) return null;
    return (typeof last.payload === 'string' ? JSON.parse(last.payload) : last.payload) as CommitteePayload;
  }, [events]);

  const agents = useMemo<AgentSummary[]>(() => {
    if (!meeting) return [];
    const map = new Map<string, CommitteeProposal[]>();
    for (const p of meeting.proposals) {
      if (!map.has(p.agent)) map.set(p.agent, []);
      map.get(p.agent)!.push(p);
    }
    return Array.from(map.entries()).map(([name, proposals]) => {
      const accepted = proposals.filter((p) => p.accepted).length;
      const total = proposals.length;
      let status: AgentStatus = 'all_accepted';
      if (accepted === 0) status = 'all_rejected';
      else if (accepted < total) status = 'partial';
      return { name, total, accepted, status, proposals };
    });
  }, [meeting]);

  if (!meeting) return null;

  const summaryLine = `ALwrity reviewed ${meeting.total_proposals} suggestions across ${meeting.agents_polled} areas of your content workflow and built today's plan from ${meeting.accepted_count} of them.`;

  return (
    <Box
      sx={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 3.5,
        boxShadow: '0 18px 50px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
        p: 2.5,
        mb: 2,
      }}
    >
      {/* Header + summary line */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem', mb: 0.25 }}>
            Daily Committee Brief
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, display: 'block', maxWidth: 480 }}>
            {summaryLine}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowDetails(!showDetails)}
          endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'none',
            color: 'rgba(255,255,255,0.5)',
            flexShrink: 0,
            '&:hover': { color: 'rgba(255,255,255,0.8)', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </Button>
      </Box>

      {/* Status banner */}
      <StatusBanner accepted={meeting.accepted_count} total={meeting.total_proposals} agents={meeting.agents_polled} />

      {/* Adoption bar */}
      <AdoptionBar accepted={meeting.accepted_count} total={meeting.total_proposals} />

      {/* Coverage flow */}
      <CoverageFlow proposals={meeting.proposals} />

      {/* Rejected proposals */}
      <RejectedList proposals={meeting.proposals} />

      {/* Details section: agent-level breakdown */}
      <Collapse in={showDetails}>
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
            Agent Breakdown
          </Typography>
          {agents.map((agent) => (
            <AgentRow
              key={agent.name}
              agent={agent}
              expanded={expandedAgent === agent.name}
              onToggle={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default CommitteeSummary;
