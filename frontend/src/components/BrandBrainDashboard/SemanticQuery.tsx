/**
 * SemanticQuery (Phase 5) — "Ask your Brand Brain" scoped semantic search.
 *
 * Scope chips (all · onboarding · strategy · calendar), per-scope preset
 * chips, free-text input + submit. State is driven by
 * ``useBrandBrainSemanticSearch``; the component never fabricates: an embedding
 * failure surfaces as an explicit error alert with empty hits.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  TerminalAlert,
  TerminalCard,
  TerminalCardContent,
  TerminalChip,
  TerminalTypography,
} from '../SchedulerDashboard/terminalTheme';
import type { BrandBrainSearchScope, BrandBrainSemanticHit } from '../../services/brandBrainApi';
import { useBrandBrainSemanticSearch } from '../../hooks/useBrandBrainSemanticSearch';
import { SCOPE_PRESETS } from './semanticPresets';

const SCOPES: { value: BrandBrainSearchScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'calendar', label: 'Calendar' },
];

const ScoreText: React.FC<{ score: number }> = ({ score }) => (
  <TerminalTypography variant="body2" sx={{ opacity: 0.7, fontSize: '0.7rem' }}>
    {score.toFixed(2)}
  </TerminalTypography>
);

const HitCard: React.FC<{ hit: BrandBrainSemanticHit }> = ({ hit }) => (
  <Box border="1px solid #00ff00" borderRadius={1} p={1} mb={1}>
    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
      <TerminalChip label={hit.domain} size="small" />
      <TerminalTypography variant="subtitle2">{hit.kind_label}</TerminalTypography>
      <Box flexGrow={1} />
      <ScoreText score={hit.score} />
    </Box>
    <TerminalTypography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {hit.text}
    </TerminalTypography>
  </Box>
);

const EducationDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        backgroundColor: '#0a0a0a',
        color: '#00ff00',
        border: '1px solid #00ff00',
        fontFamily: 'inherit',
      },
    }}
  >
    <DialogTitle sx={{ color: '#00ff00', fontFamily: 'inherit' }}>
      Ask your Brand Brain
    </DialogTitle>
    <DialogContent sx={{ color: '#00ff88', fontFamily: 'inherit' }}>
      <TerminalTypography variant="body2">
        Ask anything about your brand. The semantic search runs over the per-user
        SIF index across onboarding, strategy, and calendar — scoped by the chip
        above. Results are never fabricated: if the embedding layer is down you
        get an explicit error and no hits.
      </TerminalTypography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} sx={{ color: '#00ff00', fontFamily: 'inherit' }}>
        Got it
      </Button>
    </DialogActions>
  </Dialog>
);

const SemanticQuery: React.FC = () => {
  const [scope, setScope] = useState<BrandBrainSearchScope>('all');
  const [query, setQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const { loading, error, results, search } = useBrandBrainSemanticSearch();

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    search(trimmed, scope, 4);
  };

  const presets = SCOPE_PRESETS[scope];

  return (
    <TerminalCard>
      <TerminalCardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <TerminalTypography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            ASK YOUR BRAND BRAIN
          </TerminalTypography>
          <Tooltip title="What is scoped semantic search?">
            <Button
              size="small"
              startIcon={<HelpOutlineIcon />}
              onClick={() => setHelpOpen(true)}
              sx={{ color: '#00ff00', fontFamily: 'inherit' }}
            >
              What is this?
            </Button>
          </Tooltip>
        </Box>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          {SCOPES.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              onClick={() => setScope(s.value)}
              clickable
              color={scope === s.value ? 'success' : 'default'}
              variant={scope === s.value ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        <Box display="flex" gap={1} mb={2}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask your Brand Brain"
            size="small"
            fullWidth
            inputProps={{ 'aria-label': 'Ask your Brand Brain' }}
            sx={{
              '& .MuiInputBase-input': {
                color: '#00ff00',
                fontFamily: 'inherit',
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00ff00' },
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            sx={{
              backgroundColor: '#0a2a0a',
              color: '#00ff00',
              fontFamily: 'inherit',
              '&.Mui-disabled': {
                color: '#004400',
                backgroundColor: '#0a1a0a',
              },
            }}
          >
            Search
          </Button>
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} sx={{ color: '#00ff00' }} />
          </Box>
        )}

        {!loading && error && (
          <TerminalAlert severity="error" sx={{ mb: 2 }}>
            {error}
          </TerminalAlert>
        )}

        {!loading && results && results.hits.length === 0 && (
          <TerminalTypography variant="body2" sx={{ opacity: 0.7 }}>
            no matches in this scope
          </TerminalTypography>
        )}

        {!loading && results && results.hits.length > 0 && (
          <Box mt={1}>
            {results.hits.map((hit) => (
              <HitCard key={hit.id} hit={hit} />
            ))}
          </Box>
        )}

        {!loading && !results && presets.length > 0 && (
          <Box>
            <TerminalTypography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
              Try a question:
            </TerminalTypography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {presets.map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  onClick={() => setQuery(preset)}
                  clickable
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        <EducationDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </TerminalCardContent>
    </TerminalCard>
  );
};

export default SemanticQuery;