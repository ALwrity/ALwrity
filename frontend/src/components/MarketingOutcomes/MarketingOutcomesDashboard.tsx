import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getWorkflowOutcomes } from '../../api/onboarding';
import type { ProviderOutcome, WorkflowOutcomes } from '../../types/workflow';

const metricLabel = (key: string) => key.replace(/_/g, ' ');

const formatMetric = (key: string, value: number | null) => {
  if (value == null) return '—';
  if (key.toLowerCase().includes('rate') || key.toLowerCase() === 'ctr' || key.toLowerCase() === 'clickthroughrate') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const ProviderCard: React.FC<{
  title: string;
  provider: ProviderOutcome;
  onConnect?: () => void;
}> = ({ title, provider, onConnect }) => {
  const available = provider.status === 'available';
  const comingSoon = provider.reason_code === 'coming_soon';
  const noData = provider.reason_code === 'no_data';
  const stale = provider.freshness_status === 'stale';
  const freshness = provider.freshness_status === 'stale' ? 'Stale data' : provider.fetched_at ? `Updated ${new Date(provider.fetched_at).toLocaleString()}` : null;
  return (
    <Card sx={{ height: '100%', background: 'rgba(255,255,255,0.96)' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">{title}</Typography>
          <Typography
            variant="caption"
            sx={{
              color: available && !stale ? 'success.main' : comingSoon ? 'text.secondary' : 'warning.main',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {stale ? 'Stale data' : available ? 'Measured' : comingSoon ? 'Coming soon' : noData ? 'No data yet' : provider.reason_code === 'provider_error' ? 'Unavailable' : 'Connect required'}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {available ? `Source: ${provider.source}` : provider.reason || 'Connect this provider to measure results.'}
        </Typography>
        {freshness && <Typography variant="caption" color={provider.freshness_status === 'stale' ? 'warning.main' : 'text.secondary'} display="block" mb={1}>{freshness}</Typography>}
        {available && provider.metrics ? (
          <Stack spacing={0.75}>
            {Object.entries(provider.metrics).map(([key, value]) => (
              <Stack direction="row" justifyContent="space-between" key={key}>
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{metricLabel(key)}</Typography>
                <Typography variant="body2" fontWeight={700}>{formatMetric(key, value)}</Typography>
              </Stack>
            ))}
          </Stack>
        ) : !comingSoon && !noData && provider.reason_code === 'connect_required' ? (
          <Button size="small" variant="outlined" onClick={onConnect}>
          Connect provider
        </Button>
        ) : null}
        {available && provider.attribution ? (
          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Attribution confidence: {provider.attribution.fully_attributed} fully linked, {provider.attribution.partially_attributed} partial
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
};

const MarketingOutcomesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [outcomes, setOutcomes] = React.useState<WorkflowOutcomes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState(30);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async (windowDays = days) => {
    setLoading(!outcomes);
    setRefreshing(Boolean(outcomes));
    setError(null);
    try {
      setOutcomes(await getWorkflowOutcomes(windowDays));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load marketing outcomes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, outcomes]);

  React.useEffect(() => { void load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <Box display="flex" justifyContent="center" p={8}><CircularProgress /></Box>;
  }
  if (error || !outcomes) {
    return <Container maxWidth="lg"><Alert severity="error">{error || 'No outcome data available.'}</Alert></Container>;
  }

  const providers = outcomes.real_outcomes;
  return (
    <Box sx={{ minHeight: '100vh', py: 5, background: 'linear-gradient(135deg, #172554 0%, #312e81 48%, #581c87 100%)' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={4} gap={2}>
          <Box>
            <Typography variant="h3" color="white" fontWeight={800}>Marketing outcomes</Typography>
            <Typography color="rgba(255,255,255,0.75)">Measured results from the last {days} days. Predictions are never shown as results.</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 110, background: 'rgba(255,255,255,0.96)', borderRadius: 1 }}>
              <Select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Outcome time window">
                {[7, 14, 28, 30, 90].map(value => <MenuItem value={value} key={value}>{value} days</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" disabled={refreshing} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }} onClick={() => void load(days)}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }} onClick={() => navigate('/dashboard')}>
              Back
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2} mb={3}>
          {[
            ['Tasks accepted', outcomes.tasks.accepted, outcomes.tasks.acceptance_rate == null ? 'No decisions yet' : `${(outcomes.tasks.acceptance_rate * 100).toFixed(1)}% acceptance`],
            ['Execution success', outcomes.execution.successful, outcomes.execution.success_rate == null ? 'No executions yet' : `${(outcomes.execution.success_rate * 100).toFixed(1)}% success`],
            ['Published tasks', outcomes.publishing.completed, outcomes.publishing.consistency_rate == null ? 'No publish tasks yet' : `${(outcomes.publishing.consistency_rate * 100).toFixed(1)}% consistency`],
          ].map(([label, value, detail]) => (
            <Grid item xs={12} md={4} key={String(label)}>
              <Card sx={{ background: 'rgba(255,255,255,0.96)' }}><CardContent>
                <Typography color="text.secondary">{label}</Typography>
                <Typography variant="h3" fontWeight={800}>{value}</Typography>
                <Typography variant="body2" color="text.secondary">{detail}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          {providers ? <>
            <Grid item xs={12} md={6}><ProviderCard title="Google Search Console" provider={providers.gsc} onConnect={() => navigate('/seo-dashboard')} /></Grid>
            <Grid item xs={12} md={6}><ProviderCard title="Published content" provider={providers.published_pages} /></Grid>
            <Grid item xs={12} md={6}><ProviderCard title="LinkedIn" provider={providers.linkedin} onConnect={() => navigate('/linkedin-studio')} /></Grid>
            <Grid item xs={12} md={6}><ProviderCard title="Facebook" provider={providers.facebook} onConnect={() => navigate('/facebook-writer')} /></Grid>
            <Grid item xs={12} md={6}><ProviderCard title="Conversions" provider={providers.conversions} /></Grid>
          </> : <Grid item xs={12}><Alert severity="info">Provider outcome adapters are not available yet.</Alert></Grid>}
        </Grid>
        {providers?.conversions?.attribution && (
          <Card sx={{ mt: 2, background: 'rgba(255,255,255,0.96)' }}>
            <CardContent>
              <Typography variant="h6" mb={1}>Conversion attribution</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {providers.conversions.attribution.confidence_basis}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Typography variant="body2">Fully linked: <strong>{providers.conversions.attribution.fully_attributed}</strong></Typography>
                <Typography variant="body2">Partial: <strong>{providers.conversions.attribution.partially_attributed}</strong></Typography>
                <Typography variant="body2">Unattributed: <strong>{providers.conversions.attribution.unattributed}</strong></Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
        {outcomes.lineage && outcomes.lineage.length > 0 && (
          <Card sx={{ mt: 2, background: 'rgba(255,255,255,0.96)' }}>
            <CardContent>
              <Typography variant="h6" mb={1}>Recommendation lineage</Typography>
              <Stack spacing={1}>
                {outcomes.lineage.map(item => (
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} key={`${item.task_id}-${item.recommendation_id}`}>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{item.title || item.recommendation_id || 'Recommendation'}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.status} · {item.source_agent || 'workflow'}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {item.artifact_id && <Button size="small" onClick={() => navigate(`/asset-library?asset_id=${encodeURIComponent(String(item.artifact_id))}`)}>Artifact</Button>}
                      {item.action_url && <Button size="small" onClick={() => navigate(item.action_url || '/dashboard')}>Open task</Button>}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  );
};

export default MarketingOutcomesDashboard;
