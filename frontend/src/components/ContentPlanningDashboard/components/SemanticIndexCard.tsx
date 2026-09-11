import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';

import { useStrategySifStatus } from '../../../hooks/useStrategySifStatus';
import { contentPlanningApi } from '../../../services/contentPlanningApi';
import { isStrategySifEducationEnabled } from '../../../config/strategySifConfig';
import SemanticIndexEducationDialog from './SemanticIndexEducationDialog';

interface SearchHit {
  id: string;
  kind?: string;
  kind_label?: string;
  score?: number;
  text?: string;
}

// Preset questions pinned to the 8 indexed strategy kinds — the same
// "click a question to see the SIF answer" pattern as the onboarding
// SifIndexingPanel, reworded for strategy content.
const STRATEGY_QUERIES = [
  'What are the business objectives?',
  'Summarize the competitive analysis',
  'What does the implementation roadmap look like?',
  'What target metrics are we tracking?',
  'Describe the target audience persona',
  'Summarize the key strategic insights',
];

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

type PassageFormat = 'json' | 'kv' | 'text';

interface ParsedPassage {
  format: PassageFormat;
  body?: string;
  entries?: { label: string; value: string }[];
}

// Strategy chunks are stored as raw text: the 8 kinds embed either JSON
// (analyse components such as implementation_roadmap / risk_assessment) or
// "label: value" lines (form_summary / user_persona_digest). Rendering the
// raw blob is noisy, so we pretty-print JSON and collapse empty KV lines.
const parsePassage = (raw: string): ParsedPassage => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { format: 'text' };

  try {
    const parsed = JSON.parse(trimmed);
    return { format: 'json', body: JSON.stringify(parsed, null, 2) };
  } catch {
    /* not JSON — fall through to KV detection */
  }

  const entries: { label: string; value: string }[] = [];
  for (const line of trimmed.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (label && value) entries.push({ label, value });
    }
  }
  if (entries.length >= 2) return { format: 'kv', entries };
  return { format: 'text', body: trimmed };
};

const renderPassage = (text: string) => {
  const parsed = parsePassage(text);
  if (parsed.format === 'json') {
    return (
      <Box
        component="pre"
        data-testid="semantic-passage-json"
        sx={{
          m: 0,
          mt: 0.5,
          maxHeight: 200,
          overflow: 'auto',
          fontSize: '0.72rem',
          lineHeight: 1.45,
          color: '#334155',
          whiteSpace: 'pre',
        }}
      >
        {parsed.body}
      </Box>
    );
  }
  if (parsed.format === 'kv') {
    return (
      <Stack data-testid="semantic-passage-kv" spacing={0.25} sx={{ mt: 0.5 }}>
        {(parsed.entries || []).map((e) => (
          <Typography key={e.label} variant="body2" sx={{ fontSize: '0.75rem', color: '#334155' }}>
            <Box component="span" sx={{ fontWeight: 600, color: '#1e293b' }}>{e.label}:</Box>{' '}
            {truncate(e.value, 200)}
          </Typography>
        ))}
      </Stack>
    );
  }
  if (!parsed.body) return null;
  return (
    <Typography variant="body2" data-testid="semantic-passage-text" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: '#334155' }}>
      {truncate(parsed.body, 240)}
    </Typography>
  );
};

const SemanticIndexCard: React.FC = () => {
  const { data, loading, error } = useStrategySifStatus({ enabled: true });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState<string | null>(null);
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([]);
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [typedQuestion, setTypedQuestion] = React.useState('');

  const handleSearch = async (query: string) => {
    if (searchBusy) return;
    setSearchBusy(true);
    setSearchQuery(query);
    setSearchError(null);
    setSearchHits([]);
    try {
      const payload = await contentPlanningApi.searchStrategySif(query, 4);
      setSearchHits((payload?.hits || []) as SearchHit[]);
    } catch (e: any) {
      setSearchError(e?.message || 'Semantic search is unavailable right now.');
    } finally {
      setSearchBusy(false);
    }
  };

  const handleAsk = () => {
    const question = typedQuestion.trim();
    if (!question || searchBusy) return;
    handleSearch(question);
  };

  // Graceful degradation: if the read-only status endpoint errors, render nothing.
  if (error) return null;

  if (loading || !data) {
    return (
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack spacing={1} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Checking indexing status…
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const phase = data.indexing?.phase ?? 'not_indexed';
  const count = data.indexing?.embedding_count ?? data.watermark?.embedding_count ?? 0;

  // Queries make sense only when the strategy is actually searchable:
  // a successful embed, or a prior pass that indexed the unchanged strategy.
  const isIndexed = count > 0 && (phase === 'success' || phase === 'skipped');

  const getStatus = (): { label: string; icon: React.ReactElement; color: any; body: string } => {
    switch (phase) {
      case 'pending':
        return {
          label: 'Indexing scheduled',
          icon: <ScheduleIcon />,
          color: 'info',
          body: 'Indexing is scheduled to run in the background. Your workflow is unaffected while it runs in parallel.',
        };
      case 'running':
        return {
          label: 'Indexing in progress',
          icon: <SyncIcon />,
          color: 'primary',
          body: 'Indexing your content strategy in the background. It runs alongside your work and won’t slow anything down. Check back here for the result.',
        };
      case 'success':
        return {
          label: 'Indexed & searchable',
          icon: <CheckCircleIcon />,
          color: 'success',
          body: `${count} documents from your content strategy were prepared for AI-powered search. Your strategy is now indexed.`,
        };
      case 'skipped':
        return {
          label: 'No changes to index',
          icon: <PublishedWithChangesIcon />,
          color: 'default',
          body: 'Nothing new to index — your strategy hasn’t changed since the last indexing pass.',
        };
      case 'failed':
        return {
          label: 'Indexing needs attention',
          icon: <ErrorIcon />,
          color: 'error',
          body: `Your strategy couldn’t be indexed: ${data.indexing?.error_message || 'unknown error'}. Try re-activating the strategy to retry.`,
        };
      case 'not_indexed':
        return {
          label: 'Not yet indexed',
          icon: <HourglassEmptyIcon />,
          color: 'default',
          body: 'No index has been run for your strategy yet. Re-activating the strategy schedules the first indexing pass.',
        };
      case 'no_active_strategy':
        return {
          label: 'No active strategy',
          icon: <InfoIcon />,
          color: 'info',
          body: 'Activate a content strategy to enable the semantic search index for your content plan.',
        };
      default:
        return {
          label: 'Status unavailable',
          icon: <InfoIcon />,
          color: 'default',
          body: 'Semantic index status is not available right now. Check back here shortly.',
        };
    }
  };

  const status = getStatus();

  return (
    <Card variant="outlined" data-testid="semantic-index-card" sx={{ mt: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6" component="h3">
              Semantic Index
            </Typography>
            <Typography variant="body2" color="text.secondary">
              How your content strategy is prepared for AI-powered search
            </Typography>
          </Box>
          <Chip
            icon={status.icon}
            label={status.label}
            color={status.color}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="body2" color="text.secondary">
          {status.body}
        </Typography>
        {isIndexed && (
          <Box
            data-testid="semantic-try-queries"
            sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Try a semantic search
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Ask a question about your content strategy and SIF retrieves the matching passage straight from your indexed strategy — no canned answers.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                size="small"
                value={typedQuestion}
                onChange={(e) => setTypedQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAsk();
                }}
                placeholder="Ask your strategy, e.g. what risks were identified?"
                disabled={searchBusy}
                inputProps={{ 'data-testid': 'semantic-question-input' }}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleAsk}
                disabled={searchBusy || typedQuestion.trim().length === 0}
                data-testid="semantic-ask-button"
                sx={{ textTransform: 'none' }}
              >
                Ask SIF
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
              …or pick a preset:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {STRATEGY_QUERIES.map((q) => (
                <Chip
                  key={q}
                  label={q}
                  size="small"
                  variant="outlined"
                  onClick={() => handleSearch(q)}
                  disabled={searchBusy}
                  data-testid="semantic-query-chip"
                />
              ))}
            </Box>
            {searchQuery && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Answers for “{searchQuery}”:
              </Typography>
            )}
            {searchBusy && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Searching your strategy…
                </Typography>
              </Stack>
            )}
            {searchError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }} data-testid="semantic-search-error">
                {searchError}
              </Typography>
            )}
            {searchHits.length > 0 && (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {searchHits.map((h) => (
                  <Box
                    key={h.id}
                    data-testid="semantic-search-hit"
                    sx={{ p: 1.25, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #e8ecf1' }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#2563eb' }}>
                        {h.kind_label || h.kind || 'Strategy passage'}
                      </Typography>
                      {typeof h.score === 'number' && (
                        <Typography variant="caption" color="text.secondary">
                          score {h.score.toFixed(3)}
                        </Typography>
                      )}
                    </Stack>
{renderPassage(h.text || '')}
                  </Box>
                ))}
              </Stack>
            )}
            {!searchBusy && searchQuery && searchHits.length === 0 && !searchError && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }} data-testid="semantic-search-empty">
                No matching passage found in the current strategy — try another question.
              </Typography>
            )}
          </Box>
        )}
        {isStrategySifEducationEnabled() && (
          <Button
            size="small"
            variant="outlined"
            data-testid="semantic-index-education-trigger"
            onClick={() => setDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Learn how the index works
          </Button>
        )}
        <SemanticIndexEducationDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          documentKindNames={data.document_kinds?.names}
        />
      </CardContent>
    </Card>
  );
};

export default SemanticIndexCard;