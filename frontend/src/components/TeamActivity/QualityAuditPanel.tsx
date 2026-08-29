import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  Button,
  LinearProgress,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GavelIcon from '@mui/icons-material/Gavel';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AgentEventItem } from '../../hooks/useAgentHuddleFeed';

interface ReasoningIssue { title: string; reasoning: string; score: number }
interface PriorityIssue { title: string; pillar: string; priority: string; note: string }
interface PillarIssue { title: string; proposed_pillar: string; expected_pillar: string; note: string }
interface RejectedDetail { title: string; reason: string }
interface AgentIssue {
  type: string; severity: string; count: number; summary: string;
  details?: ReasoningIssue[] | PriorityIssue[] | PillarIssue[] | RejectedDetail[];
  action_label?: string; action_url?: string | null;
}
interface AgentCritique {
  agent: string; label: string; short: string;
  score: number; health: string;
  total_proposals: number; accepted: number; rejected: number;
  acceptance_rate: number;
  issues: AgentIssue[];
  summary: string;
}
interface CoverageGap { pillar_id: string; severity: string; summary: string; action_label?: string; action_url?: string | null }
interface Overlap { title: string; pillar: string; agents: string[]; count: number; severity: string; summary: string; action_label?: string; action_url?: string | null }
interface AuditAlert { type: string; severity: string; agent?: string; label?: string; title: string; message: string; cta_path?: string | null }

interface AuditReport {
  health_score: number; verdict: string;
  agent_critiques: AgentCritique[];
  coverage_gaps: CoverageGap[];
  overstuffed_pillars?: CoverageGap[];
  overlaps: Overlap[];
  alerts: AuditAlert[];
  audit_timestamp: string;
}

const healthColor = (score: number) => score >= 80 ? '#4caf50' : score >= 50 ? '#ff9800' : '#f44336';
const healthLabel = (score: number) => score >= 80 ? 'Healthy' : score >= 50 ? 'Needs review' : 'Failing';

// ── Health Ring ─────────────────────────────────────
const HealthRing: React.FC<{ score: number }> = ({ score }) => {
  const color = healthColor(score);
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
      <Box sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
        <svg width={80} height={80} viewBox="0 0 80 80">
          <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
          <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 40 40)" strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <Typography sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '1.3rem', color: color, lineHeight: 1,
        }}>
          {score}
        </Typography>
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>
          Committee Health — {healthLabel(score)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', lineHeight: 1.4, mt: 0.25 }}>
          {score >= 80 ? 'All agents submitting quality proposals.' : score >= 50 ? 'Some agents need attention.' : 'Significant issues detected.'}
        </Typography>
      </Box>
    </Box>
  );
};

// ── Agent Critique Card ─────────────────────────────
const issueIcon = (sev: string) => {
  if (sev === 'error') return <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />;
  if (sev === 'warning') return <WarningIcon sx={{ fontSize: 14, color: '#ff9800' }} />;
  return <InfoIcon sx={{ fontSize: 14, color: '#2196f3' }} />;
};

const issueBg = (sev: string) => sev === 'error' ? 'rgba(244,67,54,0.08)' : sev === 'warning' ? 'rgba(255,152,0,0.08)' : 'rgba(33,150,243,0.08)';

const AgentCritiqueCard: React.FC<{ critique: AgentCritique; onNavigate: (url: string, state?: Record<string, unknown>) => void }> = ({ critique, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const color = healthColor(critique.score);
  const hasIssues = critique.issues.length > 0;

  return (
    <Box sx={{
      p: 1.5, borderRadius: 2,
      bgcolor: critique.health === 'failing' ? 'rgba(244,67,54,0.04)' : critique.health === 'warning' ? 'rgba(255,152,0,0.04)' : 'rgba(76,175,80,0.04)',
      border: `1px solid ${color}22`,
    }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: 13, flex: 1 }}>
          {critique.label}
        </Typography>
        <Chip label={`${critique.accepted}/${critique.total_proposals}`} size="small" sx={{
          height: 18, fontSize: 9, fontWeight: 700,
          bgcolor: critique.acceptance_rate > 0.5 ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
          color: critique.acceptance_rate > 0.5 ? '#4caf50' : '#f44336',
        }} />
        <Chip label={`${critique.score}/100`} size="small" sx={{
          height: 18, fontSize: 9, fontWeight: 700, bgcolor: `${color}22`, color,
        }} />
      </Box>

      {/* Mini bar */}
      <LinearProgress variant="determinate" value={critique.score} sx={{
        height: 3, borderRadius: 1.5, mb: 0.75,
        bgcolor: 'rgba(255,255,255,0.06)',
        '& .MuiLinearProgress-bar': { bgcolor: color },
      }} />

      {/* Summary */}
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, display: 'block' }}>
        {critique.summary}
      </Typography>

      {/* Issues */}
      {hasIssues && (
        <>
          <Box onClick={() => setExpanded(!expanded)} sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, cursor: 'pointer',
            '&:hover': { opacity: 0.8 }, userSelect: 'none',
          }}>
            <GavelIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 10 }}>
              {critique.issues.length} issue{critique.issues.length > 1 ? 's' : ''}
            </Typography>
            {expanded ? <ExpandLessIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />}
          </Box>
          <Collapse in={expanded}>
            <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {critique.issues.map((issue, i) => (
                <Box key={i} sx={{ p: 0.75, borderRadius: 1.5, bgcolor: issueBg(issue.severity), border: `1px solid ${issue.severity === 'error' ? 'rgba(244,67,54,0.15)' : issue.severity === 'warning' ? 'rgba(255,152,0,0.15)' : 'rgba(33,150,243,0.15)'}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                    {issueIcon(issue.severity)}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 10, display: 'block' }}>
                        {issue.summary}
                      </Typography>
                      {issue.details && (issue.details as any[]).slice(0, 2).map((d: any, j) => (
                        <Box key={j} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, display: 'block' }}>
                            • {d.title}: {d.reasoning || d.reason || d.note || ''}
                          </Typography>
                        </Box>
                      ))}
                      {issue.details && (issue.details as any[]).length > 2 && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>
                          +{(issue.details as any[]).length - 2} more
                        </Typography>
                      )}
                    </Box>
                    {issue.action_url && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={(e) => { e.stopPropagation(); onNavigate(issue.action_url!); }}
                        sx={{ textTransform: 'none', fontSize: 9, color: '#4f46e5', py: 0, minWidth: 0, pl: 0.5 }}
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 10 }} />}
                      >
                        {issue.action_label || 'View'}
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

// ── Coverage Gap Row ─────────────────────────────────
const GapRow: React.FC<{ gap: CoverageGap; onNavigate: (url: string, state?: Record<string, unknown>) => void }> = ({ gap, onNavigate }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 0.5, borderRadius: 1, bgcolor: 'rgba(255,152,0,0.06)' }}>
    <WarningIcon sx={{ fontSize: 12, color: '#ff9800' }} />
    <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{gap.summary}</Typography>
    <Chip label={`pillar: ${gap.pillar_id}`} size="small" sx={{ height: 16, fontSize: 8, fontWeight: 600, bgcolor: 'rgba(255,152,0,0.1)', color: '#ff9800' }} />
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        const url = gap.action_url || '/content-planning';
        onNavigate(url, { pillarId: gap.pillar_id, source: 'quality_audit_gap' });
      }}
      sx={{
        textTransform: 'none', fontSize: 9, py: 0.125, px: 0.75, minWidth: 0,
        borderColor: 'rgba(255,152,0,0.3)', color: '#ff9800',
        '&:hover': { borderColor: '#ff9800', bgcolor: 'rgba(255,152,0,0.08)' },
      }}
    >
      {gap.action_label || 'Fill gap'}
    </Button>
  </Box>
);

// ── Overlap Row ──────────────────────────────────────
const OverlapRow: React.FC<{ overlap: Overlap; onNavigate: (url: string, state?: Record<string, unknown>) => void }> = ({ overlap, onNavigate }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 0.5, borderRadius: 1, bgcolor: 'rgba(33,150,243,0.06)' }}>
    <InfoIcon sx={{ fontSize: 12, color: '#2196f3' }} />
    <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{overlap.summary}</Typography>
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        const url = overlap.action_url || '/content-planning';
        onNavigate(url, { pillar: overlap.pillar, overlapAgents: overlap.agents, source: 'quality_audit_overlap' });
      }}
      sx={{
        textTransform: 'none', fontSize: 9, py: 0.125, px: 0.75, minWidth: 0,
        borderColor: 'rgba(33,150,243,0.3)', color: '#2196f3',
        '&:hover': { borderColor: '#2196f3', bgcolor: 'rgba(33,150,243,0.08)' },
      }}
    >
      {overlap.action_label || 'Resolve'}
    </Button>
  </Box>
);

// ── Alert Row ────────────────────────────────────────
const AlertRow: React.FC<{ alert: AuditAlert; onNavigate: (url: string) => void }> = ({ alert, onNavigate }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 0.5, borderRadius: 1, bgcolor: alert.severity === 'error' ? 'rgba(244,67,54,0.06)' : alert.severity === 'warning' ? 'rgba(255,152,0,0.06)' : 'rgba(33,150,243,0.06)' }}>
    {alert.severity === 'error' ? <ErrorIcon sx={{ fontSize: 12, color: '#f44336' }} /> : alert.severity === 'warning' ? <WarningIcon sx={{ fontSize: 12, color: '#ff9800' }} /> : <InfoIcon sx={{ fontSize: 12, color: '#2196f3' }} />}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 10, display: 'block' }}>
        {alert.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, display: 'block' }}>
        {alert.message}
      </Typography>
    </Box>
    {alert.cta_path && (
      <Button
        size="small"
        variant="text"
        onClick={() => onNavigate(alert.cta_path!)}
        endIcon={<OpenInNewIcon sx={{ fontSize: 10 }} />}
        sx={{ textTransform: 'none', fontSize: 9, color: '#4f46e5', py: 0, minWidth: 0 }}
      >
        View
      </Button>
    )}
  </Box>
);

// ── Main Component ───────────────────────────────────
const QualityAuditPanel: React.FC<{ events: AgentEventItem[] }> = ({ events }) => {
  const navigate = useNavigate();

  const report = useMemo<AuditReport | null>(() => {
    const evt = events.find((e) => e.event_type === 'quality_audit');
    if (!evt?.payload) return null;
    return (typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload) as AuditReport;
  }, [events]);

  const [critiquesOpen, setCritiquesOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [overlapsOpen, setOverlapsOpen] = useState(false);

  const handleNavigate = useCallback((url: string, state?: Record<string, unknown>) => {
    if (url.startsWith('/')) {
      navigate(url, { state: state || {} });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [navigate]);

  if (!report) return null;

  const hasAlerts = report.alerts.length > 0;
  const hasGaps = report.coverage_gaps.length > 0;
  const hasOverlaps = report.overlaps.length > 0;

  return (
    <Box sx={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
      border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3.5,
      boxShadow: '0 18px 50px rgba(0,0,0,0.25)', p: 2.5, mb: 2,
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <GavelIcon sx={{ fontSize: 18, color: healthColor(report.health_score) }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem' }}>
          Committee Watchdog
        </Typography>
        {hasAlerts && (
          <Chip label={`${report.alerts.length} alert${report.alerts.length > 1 ? 's' : ''}`} size="small" sx={{
            ml: 'auto', height: 20, fontSize: 10, fontWeight: 700,
            bgcolor: 'rgba(244,67,54,0.15)', color: '#f44336',
          }} />
        )}
      </Box>

      {/* Health gauge + verdict */}
      <HealthRing score={report.health_score} />
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 1.5, lineHeight: 1.4, fontStyle: 'italic' }}>
        {report.verdict}
      </Typography>

      {/* Alerts */}
      {hasAlerts && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(244,67,54,0.8)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, display: 'block', mb: 0.5 }}>
            Alerts ({report.alerts.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {report.alerts.map((a, i) => <AlertRow key={i} alert={a} onNavigate={handleNavigate} />)}
          </Box>
        </Box>
      )}

      {/* Agent critiques */}
      {report.agent_critiques.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Box onClick={() => setCritiquesOpen(!critiquesOpen)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.8 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, flex: 1 }}>
              Agent Critiques ({report.agent_critiques.length})
            </Typography>
            {critiquesOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />}
          </Box>
          <Collapse in={critiquesOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {report.agent_critiques.map((c, i) => (
                <AgentCritiqueCard key={i} critique={c} onNavigate={handleNavigate} />
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Coverage gaps */}
      {hasGaps && (
        <Box sx={{ mb: 1.5 }}>
          <Box onClick={() => setGapsOpen(!gapsOpen)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.8 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,152,0,0.7)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, flex: 1 }}>
              Coverage Gaps ({report.coverage_gaps.length})
            </Typography>
            {gapsOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />}
          </Box>
          <Collapse in={gapsOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {report.coverage_gaps.map((g, i) => <GapRow key={i} gap={g} onNavigate={handleNavigate} />)}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Overlaps */}
      {hasOverlaps && (
        <Box sx={{ mb: 1.5 }}>
          <Box onClick={() => setOverlapsOpen(!overlapsOpen)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.8 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(33,150,243,0.7)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, flex: 1 }}>
              Overlaps ({report.overlaps.length})
            </Typography>
            {overlapsOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />}
          </Box>
          <Collapse in={overlapsOpen}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {report.overlaps.map((o, i) => <OverlapRow key={i} overlap={o} onNavigate={handleNavigate} />)}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Auto-collapse hint */}
      {!critiquesOpen && !gapsOpen && !overlapsOpen && !hasAlerts && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', display: 'block', textAlign: 'center', fontSize: 9, mt: 0.5 }}>
          Tap sections above to expand details
        </Typography>
      )}
    </Box>
  );
};

export default QualityAuditPanel;