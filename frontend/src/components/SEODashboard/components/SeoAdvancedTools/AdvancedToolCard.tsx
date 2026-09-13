import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
} from '@mui/material';
import { GlassCard } from '../../../shared/styled';
import { useAbortableRequest, isCancelError } from '../../useAbortableRequest';
import { type AdvancedToolContext, type AdvancedToolDef } from './advancedToolDefs';

interface AdvancedToolCardProps {
  def: AdvancedToolDef;
  ctx: AdvancedToolContext;
}

const AdvancedToolCard: React.FC<AdvancedToolCardProps> = ({ def, ctx }) => {
  const nextSignal = useAbortableRequest();
  // Prefill follows context availability (e.g. audit completes after mount),
  // but never clobbers text the user is editing: arm once on the off→on flip.
  const prefill = def.buildPayload(ctx);
  const [armed, setArmed] = useState(prefill !== null);
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(prefill ?? {}, null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  if (!armed && prefill !== null) {
    setArmed(true);
    setPayloadText(JSON.stringify(prefill, null, 2));
  }

  // No fabrication: without required context the card stays disabled.
  if (prefill === null) {
    return (
      <GlassCard sx={{ p: 2, height: '100%', opacity: 0.75 }}>
        <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }}>
          {def.title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 2 }}>
          {def.description}
        </Typography>
        <Alert severity="info">{def.missingHint}</Alert>
        <Button variant="contained" size="small" disabled sx={{ mt: 2, textTransform: 'none' }}>
          {def.runLabel}
        </Button>
      </GlassCard>
    );
  }

  const handleRun = async () => {
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(payloadText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('payload must be a JSON object');
      }
      payload = parsed as Record<string, unknown>;
    } catch (err: any) {
      setError(`Invalid JSON payload: ${err?.message ?? err}`);
      return;
    }
    // AbortSignal is plumbed for cancellation parity; the underlying client
    // calls are single-shot POSTs resolved by the test doubles below.
    void nextSignal();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await def.run(payload);
      setResult(data);
    } catch (err: any) {
      // Cancellation is not a failure — stay silent, keep the payload.
      if (isCancelError(err)) return;
      setError(err?.response?.data?.detail || err?.message || `${def.title} failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700 }}>
        {def.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 2 }}>
        {def.description}
      </Typography>

      <TextField
        fullWidth
        multiline
        minRows={4}
        maxRows={10}
        size="small"
        label={`${def.title} payload JSON`}
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        disabled={loading}
        sx={{ mb: 1.5 }}
        inputProps={{ spellCheck: false, style: { fontFamily: 'monospace', fontSize: '0.7rem' } }}
      />

      <Button
        variant="contained"
        size="small"
        onClick={handleRun}
        disabled={loading}
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
        <Box
          component="pre"
          sx={{
            mt: 2,
            p: 1.5,
            maxHeight: 220,
            overflow: 'auto',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.85)',
            bgcolor: 'rgba(0,0,0,0.3)',
            borderRadius: 1,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </Box>
      )}
    </GlassCard>
  );
};

export default AdvancedToolCard;
