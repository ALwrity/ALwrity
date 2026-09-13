import React, { useState, useEffect, Fragment } from 'react';
import {
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
  MenuItem,
  Chip,
  Box,
} from '@mui/material';
import { GlassCard } from '../../../shared/styled';
import { useAbortableRequest, isCancelError } from '../../useAbortableRequest';
import { parseCommaList, isValidHttpUrl } from '../../seoFormParsers';
import { type ToolDef } from './toolDefs';
import { ToolResultView } from './toolResults';
import { ResultActions } from './ResultActions';
import { ToolRunHistory } from './ToolRunHistory';
import { saveToolRun, clearToolHistory, toolHistoryFor, type ToolRunRecord } from './seoToolsHistory';

// Whole-card + per-input validation before anything fires. Precedence:
// card-level rules (e.g. image-alt XOR) first, then per-input URL checks.
// Blank URLs are allowed (they fall back to the site URL); invalid non-blank
// URLs fail fast so we never send a doomed request to the backend.
const validateInputs = (
  def: ToolDef,
  values: Record<string, string>,
  files: Record<string, File | null>,
): string | null => {
  if (def.validate) {
    const whole = def.validate(values, files);
    if (whole) return whole;
  }
  for (const input of def.inputs) {
    if (input.validate === 'url') {
      const raw = (values[input.name] ?? '').trim();
      if (raw && !isValidHttpUrl(raw)) {
        return `Enter a valid http(s) URL for ${input.label}.`;
      }
    }
  }
  return null;
};

interface SeoToolCardProps {
  def: ToolDef;
  siteUrl: string;
  /** Phase 12 (plan C3): onboarding-derived initial values (real data only). */
  prefill?: Record<string, string>;
}

const SeoToolCard: React.FC<SeoToolCardProps> = ({ def, siteUrl, prefill }) => {
  const nextSignal = useAbortableRequest();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const input of def.inputs) {
      if (input.kind === 'select') {
        initial[input.name] = input.options?.[0] ?? '';
      } else if (input.defaultFromSite) {
        initial[input.name] = siteUrl;
      } else {
        initial[input.name] = '';
      }
    }
    // Only apply prefill keys the card actually owns — never inject unknown fields.
    if (prefill) {
      for (const [name, value] of Object.entries(prefill)) {
        if (def.inputs.some((input) => input.name === name) && typeof value === 'string') {
          initial[name] = value;
        }
      }
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [files, setFiles] = useState<Record<string, File | null>>(() => {
    const initial: Record<string, File | null> = {};
    for (const input of def.inputs) {
      if (input.kind === 'file') initial[input.name] = null;
    }
    return initial;
  });
  // Runs for THIS tool only, restored once at mount — display-only, never
  // re-executed. `onView` renders the stored result, `onClear` empties the
  // per-tool list.
  const [history, setHistory] = useState<ToolRunRecord[]>(() => toolHistoryFor(def.id));

  // Phase 12 (plan C3): onboarding prefill usually arrives AFTER mount (async
  // fetch in the panel), so apply it to still-empty owned fields when it lands;
  // never overwrite anything the user has already typed.
  useEffect(() => {
    if (!prefill) return;
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [name, value] of Object.entries(prefill)) {
        const ownsField = def.inputs.some((input) => input.name === name);
        if (ownsField && typeof value === 'string' && value && !prev[name]) {
          next[name] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [prefill, def.inputs]);

  const missingRequired = def.inputs.some(
    (input) => input.required && !(values[input.name] ?? '').trim(),
  );

  const recordError = (err: any) => setError(err?.response?.data?.detail || err?.message || `${def.title} failed.`);

  const handleRun = async () => {
    const validationError = validateInputs(def, values, files);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await def.run(values, siteUrl, nextSignal(), files);
      setResult(data);
      // Successful run persists so it can be re-viewed / copied later.
      saveToolRun({ toolId: def.id, toolTitle: def.title, siteUrl, status: 'success', result: data });
    } catch (err: any) {
      // Cancellation is not a failure — stay silent, keep inputs, don't record.
      if (isCancelError(err)) return;
      recordError(err);
      saveToolRun({ toolId: def.id, toolTitle: def.title, siteUrl, status: 'error', error: err?.response?.data?.detail || err?.message || `${def.title} failed.` });
    } finally {
      setLoading(false);
      setHistory(toolHistoryFor(def.id));
    }
  };

  const handleView = (run: ToolRunRecord) => {
    setError(null);
    setResult(run.result ?? null);
  };

  const handleClear = () => {
    clearToolHistory(def.id);
    setHistory([]);
  };

  return (
    <GlassCard sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }}>
        {def.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 2 }}>
        {def.description}
      </Typography>

      {def.inputs.map((input) => (
        <Fragment key={input.name}>
          {input.kind === 'select' ? (
            <TextField
              select
              fullWidth
              size="small"
              label={input.label}
              value={values[input.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [input.name]: String(e.target.value) }))}
              disabled={loading}
              sx={{ mb: 1.5 }}
            >
              {(input.options ?? []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          ) : input.kind === 'file' ? (
            <Button
              component="label"
              variant="outlined"
              size="small"
              fullWidth
              tabIndex={-1}
              disabled={loading}
              sx={{
                mb: 1.5,
                textTransform: 'none',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.23)',
              }}
            >
              <input
                type="file"
                accept="image/*"
                hidden
                aria-label={input.label}
                onChange={(e) =>
                  setFiles((f) => ({ ...f, [input.name]: e.target.files?.[0] ?? null }))
                }
              />
              {files[input.name] ? files[input.name]!.name : input.label}
            </Button>
          ) : input.kind === 'textarea' ? (
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              label={input.label}
              placeholder={input.placeholder}
              value={values[input.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [input.name]: e.target.value }))}
              disabled={loading}
              sx={{
                mb: 1.5,
                '& .MuiInputBase-input': { fontSize: '0.8rem' },
              }}
            />
          ) : (
            <TextField
              fullWidth
              size="small"
              label={input.label}
              placeholder={input.placeholder}
              value={values[input.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [input.name]: e.target.value }))}
              disabled={loading}
              sx={{ mb: 1.5 }}
            />
          )}
          {input.chips && (values[input.name] ?? '').trim() !== '' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {parseCommaList(values[input.name] ?? '').map((chip) => (
                <Chip key={chip} label={chip} size="small" variant="outlined" color="primary" />
              ))}
            </Box>
          )}
        </Fragment>
      ))}

      <Button
        variant="contained"
        size="small"
        onClick={handleRun}
        disabled={loading || missingRequired}
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        {loading ? 'Running…' : def.runLabel}
      </Button>

      {loading && <LinearProgress sx={{ mt: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result !== null && result !== undefined && (
        <>
          <ResultActions toolId={def.id} title={def.title} data={result} />
          <ToolResultView toolId={def.id} data={result} />
        </>
      )}

      <ToolRunHistory runs={history} onView={handleView} onClear={handleClear} />
    </GlassCard>
  );
};

export default SeoToolCard;
