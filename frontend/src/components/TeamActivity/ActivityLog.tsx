import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TerminalIcon from '@mui/icons-material/Terminal';
import { AgentRunItem, AgentEventItem } from '../../hooks/useAgentHuddleFeed';

interface ActivityLogProps {
  runs: AgentRunItem[];
  events: AgentEventItem[];
}

type Tab = 'runs' | 'events';

const ActivityLog: React.FC<ActivityLogProps> = ({ runs, events }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('runs');

  const nonCommitteeEvents = useMemo(
    () => events.filter((e) => e.event_type !== 'committee_meeting'),
    [events],
  );

  return (
    <Box
      sx={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        <TerminalIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, flex: 1, fontSize: 13 }}>
          Activity Log
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mr: 1 }}>
          <Chip
            label={`${runs.length} runs`}
            size="small"
            sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
          />
          <Chip
            label={`${nonCommitteeEvents.length} events`}
            size="small"
            sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
          />
        </Box>
        {open ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />}
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {/* Tabs */}
          <ToggleButtonGroup
            size="small"
            value={tab}
            exclusive
            onChange={(_, v) => v && setTab(v)}
            sx={{
              mb: 1,
              '& .MuiToggleButton-root': {
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'none',
                color: 'rgba(255,255,255,0.4)',
                borderColor: 'rgba(255,255,255,0.1)',
                px: 1.5,
                py: 0.25,
                '&.Mui-selected': {
                  color: '#8b9cf7',
                  bgcolor: 'rgba(102,126,234,0.15)',
                  borderColor: 'rgba(102,126,234,0.3)',
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              },
            }}
          >
            <ToggleButton value="runs">Runs</ToggleButton>
            <ToggleButton value="events">Events</ToggleButton>
          </ToggleButtonGroup>

          {/* Content */}
          <Box
            sx={{
              maxHeight: 300,
              overflow: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}
          >
            {tab === 'runs' && (
              runs.length === 0
                ? <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', display: 'block', textAlign: 'center', py: 2 }}>No runs recorded</Typography>
                : runs.slice(0, 50).map((run) => (
                    <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        bgcolor: run.status === 'completed' || run.success ? '#4caf50' : run.status === 'error' || run.success === false ? '#f44336' : run.status === 'running' ? '#2196f3' : '#9e9e9e',
                      }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 100, fontSize: 10, fontWeight: 600 }}>
                        {run.agent_type || 'agent'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', flex: 1, fontSize: 10 }}>
                        {run.status || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, minWidth: 50, textAlign: 'right' }}>
                        {run.finished_at ? new Date(run.finished_at).toLocaleTimeString() : run.started_at ? new Date(run.started_at).toLocaleTimeString() : '—'}
                      </Typography>
                    </Box>
                  ))
            )}

            {tab === 'events' && (
              nonCommitteeEvents.length === 0
                ? <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', display: 'block', textAlign: 'center', py: 2 }}>No events recorded</Typography>
                : nonCommitteeEvents.slice(0, 50).map((evt) => (
                    <Box key={evt.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 100, fontSize: 10, fontWeight: 600 }}>
                        {evt.agent_type || 'agent'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', flex: 1, fontSize: 10 }}>
                        {evt.event_type}{evt.message ? `: ${evt.message}` : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, minWidth: 50, textAlign: 'right' }}>
                        {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : '—'}
                      </Typography>
                    </Box>
                  ))
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ActivityLog;
