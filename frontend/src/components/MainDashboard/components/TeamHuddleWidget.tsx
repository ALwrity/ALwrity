import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  List,
  ListItem,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { useAgentHuddleFeed } from '../../../hooks/useAgentHuddleFeed';
import { buildHuddleTimeline } from '../../../utils/huddleTimeline';

type EventPayload = {
  phase?: string | null;
  step?: string | null;
  tool_name?: string | null;
  progress_percent?: number | null;
  input_summary?: string | null;
  output_summary?: string | null;
  decision_reason?: string | null;
  evidence_refs?: string[] | null;
  safe_debug?: boolean;
  metadata?: Record<string, unknown>;
};

const TEAM_ACTIVITY_ROUTE = '/team-activity';

const TeamHuddleWidget: React.FC = () => {
  const navigate = useNavigate();
  const { runs, events, connectionMode } = useAgentHuddleFeed({ detailTier: 'detailed' });

  // Group events by run_id and attach a run outcome line for the UI.
  const timeline = useMemo(() => buildHuddleTimeline(runs, events), [runs, events]);

  const loading = connectionMode === 'connecting' && runs.length === 0;

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6" fontWeight={700}>Team Activity</Typography>
          <Chip 
            label={connectionMode === 'sse' ? 'Live' : (connectionMode === 'polling' ? 'Polling' : 'Connecting')} 
            size="small" 
            color={connectionMode === 'sse' ? 'success' : 'warning'} 
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} 
          />
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={() => navigate(TEAM_ACTIVITY_ROUTE)}
          startIcon={<OpenInNewIcon />}
        >
          View all
        </Button>
      </Box>

      {loading && (
        <Box py={4} textAlign="center">
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && timeline.length === 0 && (
        <Typography variant="body2" color="text.secondary">No team activity yet.</Typography>
      )}

      {!loading && timeline.length > 0 && (
        <List disablePadding>
          {timeline.map(({ run, events, outcome }, index) => (
            <React.Fragment key={run.id}>
              {index > 0 && <Divider sx={{ my: 1 }} />}
              <ListItem disableGutters sx={{ display: 'block' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Chip size="small" label={run.agent_type || 'Agent'} />
                  <Chip size="small" color={run.status === 'completed' ? 'success' : 'warning'} label={run.status} />
                  <Typography variant="caption" color="text.secondary">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : ''}
                  </Typography>
                </Stack>

                {outcome.title && (
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 0.75,
                      color: outcome.kind === 'failed' ? 'error.main' : (outcome.kind === 'completed' ? 'success.dark' : 'text.secondary'),
                    }}
                  >
                    {outcome.title}
                  </Typography>
                )}

                {events.map((event) => {
                  const payload = (event.payload || {}) as EventPayload;
                  return (
                    <Accordion key={event.id} disableGutters elevation={0} sx={{ border: '1px solid #e5e7eb', mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                          <Chip size="small" label={payload.phase || event.event_type} />
                          {payload.step && <Chip size="small" variant="outlined" label={payload.step} />}
                          <Typography variant="body2" sx={{ flexGrow: 1 }}>
                            {event.message || payload.output_summary || 'Activity update'}
                          </Typography>
                          {typeof payload.progress_percent === 'number' && (
                            <Typography variant="caption" color="text.secondary">{payload.progress_percent}%</Typography>
                          )}
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" display="block">Tool: {payload.tool_name || '—'}</Typography>
                        <Typography variant="caption" display="block">Input: {payload.input_summary || '—'}</Typography>
                        <Typography variant="caption" display="block">Output: {payload.output_summary || '—'}</Typography>
                        <Typography variant="caption" display="block">Decision: {payload.decision_reason || '—'}</Typography>
                        <Typography variant="caption" display="block">Evidence: {(payload.evidence_refs || []).join(', ') || '—'}</Typography>
                        <Typography variant="caption" display="block">Safe debug: {String(payload.safe_debug ?? true)}</Typography>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default TeamHuddleWidget;
