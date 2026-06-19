import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  SmartToy as AgentIcon,
} from '@mui/icons-material';
import { getAgentTeam, type AgentTeamCatalogEntry } from '../../api/agentsTeam';

const AGENT_DESCRIPTIONS: Record<string, { short: string; long: string }> = {
  content_strategy: {
    short: 'Orchestrates content pillars and strategy',
    long: 'The Content Strategy Agent defines your content pillars, target keywords, and content calendar. It ensures alignment across all content pieces to maintain a cohesive brand narrative.',
  },
  strategy_architect: {
    short: 'Builds strategic content plans',
    long: 'The Strategy Architect develops long-term content strategies, identifies market positioning opportunities, and creates data-driven plans that align with business objectives.',
  },
  seo_optimization: {
    short: 'Optimizes content for search engines',
    long: 'The SEO Agent analyzes search trends, identifies keyword opportunities, and ensures your content is optimized for discoverability. It handles on-page SEO, meta tags, and internal linking strategies.',
  },
  social_amplification: {
    short: 'Amplifies content across social channels',
    long: 'The Social Amplification Agent creates platform-specific social media adaptations of your content, schedules posts for optimal engagement, and monitors social signals.',
  },
  competitor: {
    short: 'Monitors competitor activity and strategy',
    long: 'The Competitor Agent continuously tracks competitor content, identifies content gaps, and provides strategic intelligence on competitor positioning, keywords, and audience targeting.',
  },
  content_gap_radar: {
    short: 'Detects content coverage gaps',
    long: 'The Content Gap Radar Agent identifies topics and keywords where your content is underperforming or missing. It surfaces opportunities to capture audience interest that competitors are neglecting.',
  },
  trend_surfer: {
    short: 'Surfaces trending opportunities',
    long: 'The Trend Surfer Agent monitors real-time search trends, social signals, and market movement. It surfaces opportunities with urgency ratings, impact scores, and suggested angles for content creation.',
  },
  content_guardian: {
    short: 'Quality watchdog over committee output',
    long: 'The Content Guardian Agent audits the committee\'s output after each daily workflow. It checks reasoning quality, identifies coverage gaps, flags overlaps, and generates alerts for systemic issues. It never proposes tasks — only audits.',
  },
};

const SIF_DESCRIPTION = {
  short: 'Semantic Intelligence Framework — the orchestration layer',
  long: 'The SIF (Semantic Intelligence Framework) is ALwrity\'s orchestration layer for autonomous marketing agents. It coordinates the 6-member committee (StrategyOrchestrator, ContentStrategist, CompetitorAnalyst, SEOSpecialist, SocialMediaManager, ContentGuardian). ContentGuardian is the quality watchdog that audits the committee\'s output rather than proposing tasks. The SIF handles prompt sequencing, context card assembly, and committee voting.',
};

const AgentHelpModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentTeamCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getAgentTeam()
        .then(setAgents)
        .catch(() => setAgents([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <>
      <Tooltip title="Learn about your AI agents" arrow>
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'rgba(255,255,255,0.9)' } }}
        >
          <HelpIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            color: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AgentIcon sx={{ color: '#7c3aed' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
                Your AI Marketing Team
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Powered by the SIF Agent Framework
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#a78bfa', mb: 0.5 }}>
              SIF Agent Framework
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {SIF_DESCRIPTION.long}
            </Typography>
          </Box>

          <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${agents.length} Committee Members`}
              size="small"
              sx={{ bgcolor: 'rgba(79,70,229,0.15)', color: '#818cf8', fontWeight: 600 }}
            />
          </Box>

          {loading && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 3 }}>
              Loading agent details...
            </Typography>
          )}

          {!loading && agents.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {agents.map((agent) => {
                const desc = AGENT_DESCRIPTIONS[agent.agent_key];
                const displayName = agent.profile?.display_name || agent.defaults?.display_name_template?.replace('{website_name}', 'Your') || agent.role || agent.agent_key;
                const enabled = agent.profile?.enabled ?? agent.defaults?.enabled ?? true;
                const schedule = agent.profile?.schedule?.mode || agent.defaults?.schedule?.mode || 'on_demand';

                return (
                  <Accordion
                    key={agent.agent_key}
                    disableGutters
                    elevation={0}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px !important',
                      '&:before': { display: 'none' },
                      '&.Mui-expanded': { bgcolor: 'rgba(255,255,255,0.06)', margin: 0 },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.3)' }} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: enabled ? '#4caf50' : '#6b7280', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }} noWrap>
                            {displayName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                            {desc?.short || agent.agent_key}
                          </Typography>
                        </Box>
                        <Chip
                          label={schedule === 'on_demand' ? 'On-demand' : schedule}
                          size="small"
                          sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, mb: 1.5 }}>
                        {desc?.long || 'This agent contributes to your automated marketing workflow.'}
                      </Typography>
                      {agent.responsibilities.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                            Responsibilities
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {agent.responsibilities.map((r, i) => (
                              <Chip key={i} label={r} size="small" sx={{ height: 20, fontSize: 9, bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)' }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {agent.tools.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                            Tools
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {agent.tools.map((t, i) => (
                              <Chip key={i} label={t} size="small" variant="outlined" sx={{ height: 20, fontSize: 9, borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}

          {!loading && agents.length === 0 && (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 3 }}>
              Complete onboarding to configure your agent team.
            </Typography>
          )}
        </DialogContent>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.7)' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AgentHelpModal;