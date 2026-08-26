import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Collapse,
  TextField,
  InputAdornment,
  Button,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

const PILLAR_LABELS: Record<string, string> = {
  plan: 'Plan',
  generate: 'Generate',
  publish: 'Publish',
  analyze: 'Analyze',
  engage: 'Engage',
  remarket: 'Remarket',
};

type SortKey = 'agent' | 'title' | 'pillar_id' | 'priority' | 'valid' | 'accepted';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'accepted' | 'rejected' | 'invalid';

const sortProposals = (props: CommitteeProposal[], key: SortKey, dir: SortDir): CommitteeProposal[] => {
  return [...props].sort((a, b) => {
    const aVal = String(a[key] ?? '');
    const bVal = String(b[key] ?? '');
    const cmp = aVal.localeCompare(bVal);
    return dir === 'asc' ? cmp : -cmp;
  });
};

const CommitteeAuditTable: React.FC<{ events: AgentEventItem[] }> = ({ events }) => {
  const [sortKey, setSortKey] = useState<SortKey>('agent');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const meeting = useMemo<CommitteePayload | null>(() => {
    const last = events.find((e) => e.event_type === 'committee_meeting');
    if (!last?.payload) return null;
    return (typeof last.payload === 'string' ? JSON.parse(last.payload) : last.payload) as CommitteePayload;
  }, [events]);

  const allAgents = useMemo<string[]>(() => {
    if (!meeting) return [];
    return Array.from(new Set(meeting.proposals.map((p) => p.agent)));
  }, [meeting]);

  const filtered = useMemo<CommitteeProposal[]>(() => {
    if (!meeting) return [];
    let list = meeting.proposals;

    if (filterStatus === 'accepted') list = list.filter((p) => p.accepted);
    else if (filterStatus === 'rejected') list = list.filter((p) => !p.accepted);
    else if (filterStatus === 'invalid') list = list.filter((p) => !p.valid);

    if (filterAgent) list = list.filter((p) => p.agent === filterAgent);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.agent.toLowerCase().includes(q));
    }

    return sortProposals(list, sortKey, sortDir);
  }, [meeting, filterStatus, filterAgent, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => () => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    if (!meeting) return;
    const headers = ['Agent', 'Title', 'Pillar', 'Priority', 'Valid', 'Accepted', 'Rejected Reason', 'Reasoning', 'Est. Time', 'Action Type'];
    const rows = meeting.proposals.map((p) => [
      p.agent,
      `"${p.title.replace(/"/g, '""')}"`,
      p.pillar_id,
      p.priority,
      p.valid ? 'Yes' : 'No',
      p.accepted ? 'Yes' : 'No',
      p.rejected_reason ? `"${p.rejected_reason.replace(/"/g, '""')}"` : '',
      p.reasoning ? `"${p.reasoning.replace(/"/g, '""')}"` : '',
      p.estimated_time ?? '',
      p.action_type ?? '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `committee_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!meeting) return null;

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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontSize: '0.95rem' }}>
          Committee Audit — {meeting.total_proposals} proposals
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={exportCsv}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          CSV
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search proposals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 200,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(102,126,234,0.5)' },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['all', 'accepted', 'rejected', 'invalid'] as FilterStatus[]).map((s) => (
            <Chip
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              size="small"
              onClick={() => setFilterStatus(s)}
              sx={{
                height: 26,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'capitalize',
                bgcolor: filterStatus === s ? 'rgba(102,126,234,0.25)' : 'rgba(255,255,255,0.06)',
                color: filterStatus === s ? '#8b9cf7' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${filterStatus === s ? 'rgba(102,126,234,0.4)' : 'transparent'}`,
                '&:hover': { bgcolor: filterStatus === s ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.1)' },
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {allAgents.map((a) => (
            <Chip
              key={a}
              label={a}
              size="small"
              onClick={() => setFilterAgent(filterAgent === a ? null : a)}
              sx={{
                height: 26,
                fontSize: 11,
                fontWeight: 600,
                bgcolor: filterAgent === a ? 'rgba(102,126,234,0.25)' : 'rgba(255,255,255,0.06)',
                color: filterAgent === a ? '#8b9cf7' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${filterAgent === a ? 'rgba(102,126,234,0.4)' : 'transparent'}`,
                '&:hover': { bgcolor: filterAgent === a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.1)' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 420, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 3 } }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {([{ key: 'agent', label: 'Agent' }, { key: 'title', label: 'Title' }, { key: 'pillar_id', label: 'Pillar' }, { key: 'priority', label: 'Priority' }, { key: 'valid', label: 'Valid' }, { key: 'accepted', label: 'Accepted' }] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <TableCell
                  key={key}
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(0,0,0,0.3)',
                    py: 1,
                  }}
                >
                  <TableSortLabel
                    active={sortKey === key}
                    direction={sortKey === key ? sortDir : 'asc'}
                    onClick={handleSort(key)}
                    sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'rgba(255,255,255,0.5) !important' } }}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(0,0,0,0.3)', py: 1 }}>
                Reason
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((p, i) => {
              const isExpanded = expandedRow === i;
              return (
                <React.Fragment key={i}>
                  <TableRow
                    hover
                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                      opacity: p.accepted ? 1 : 0.55,
                    }}
                  >
                    <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, py: 0.75 }}>
                      {p.agent}
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, py: 0.75 }}>
                      {p.title}
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip
                        label={PILLAR_LABELS[p.pillar_id] || p.pillar_id}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          bgcolor: p.valid ? 'rgba(102,126,234,0.2)' : 'rgba(244,67,54,0.2)',
                          color: p.valid ? '#8b9cf7' : '#f44336',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip
                        label={p.priority}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          bgcolor: p.priority === 'high' ? 'rgba(76,175,80,0.15)' : p.priority === 'medium' ? 'rgba(255,152,0,0.15)' : 'rgba(158,158,158,0.15)',
                          color: p.priority === 'high' ? '#4caf50' : p.priority === 'medium' ? '#ff9800' : '#9e9e9e',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip
                        label={p.valid ? 'Yes' : 'No'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          bgcolor: p.valid ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                          color: p.valid ? '#4caf50' : '#f44336',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip
                        label={p.accepted ? 'Yes' : 'No'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          bgcolor: p.accepted ? 'rgba(76,175,80,0.15)' : 'rgba(158,158,158,0.15)',
                          color: p.accepted ? '#4caf50' : '#9e9e9e',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, py: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {p.rejected_reason || (p.accepted ? '—' : 'Duplicate / lower priority')}
                        {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, borderBottom: 'none', bgcolor: 'rgba(0,0,0,0.2)' }}>
                      <Collapse in={isExpanded}>
                        <Box sx={{ px: 2, py: 1.5 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
                            Reasoning
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.6, mb: 1.5 }}>
                            {p.reasoning || 'No reasoning provided.'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                                Est. Time
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
                                {p.estimated_time ? `${p.estimated_time} min` : '—'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                                Action Type
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block' }}>
                                {p.action_type || '—'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, py: 4 }}>
                  No proposals match current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CommitteeAuditTable;
