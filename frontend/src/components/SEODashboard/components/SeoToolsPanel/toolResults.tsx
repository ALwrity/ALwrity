import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  LinearProgress,
} from '@mui/material';

// Rich per-tool result renderers (Phase T1). Every access is optional-chained
// against verified backend shapes (services/seo_tools/*); missing data renders
// an honest empty state, never a crash. Unknown tool ids fall back to raw JSON.

const scoreColor = (score: number): string =>
  score >= 80 ? '#4CAF50' : score >= 60 ? '#FF9800' : '#F44336';

const Empty = ({ label }: { label: string }) => (
  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
    No {label} yet — run the tool.
  </Typography>
);

const RawJson: React.FC<{ data: unknown; startOpen?: boolean }> = ({ data, startOpen = false }) => {
  const [open, setOpen] = useState(startOpen);
  return (
    <Box sx={{ mt: 1 }}>
      <Button size="small" variant="text" onClick={() => setOpen((o) => !o)} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', p: 0, minWidth: 0 }}>
        {open ? 'Hide raw JSON' : 'Raw JSON'}
      </Button>
      {open && (
        <Box
          component="pre"
          sx={{
            mt: 1, p: 1.5, maxHeight: 200, overflow: 'auto', fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1,
          }}
        >
          {JSON.stringify(data ?? null, null, 2)}
        </Box>
      )}
    </Box>
  );
};

const MetaResult: React.FC<{ data: any }> = ({ data }) => {
  const items: any[] = Array.isArray(data?.meta_descriptions) ? data.meta_descriptions : [];
  const avg: number | undefined = data?.analysis?.average_seo_score;
  if (items.length === 0) return <Empty label="descriptions" />;
  return (
    <Box sx={{ mt: 1 }}>
      {avg !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
            Average SEO score: {avg}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, Number(avg) || 0))}
            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
          />
        </Box>
      )}
      {items.map((d, i) => (
        <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'white' }}>
            {d?.text ?? '(empty description)'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${d?.character_count ?? '?'} chars`} variant="outlined" />
            {d?.length_status && <Chip size="small" label={d.length_status} variant="outlined" />}
            {d?.seo_score !== undefined && (
              <Chip
                size="small"
                label={`score ${d.seo_score}`}
                sx={{ color: scoreColor(Number(d.seo_score) || 0) }}
                variant="outlined"
              />
            )}
          </Box>
          {(d?.recommendations ?? []).slice(0, 2).map((r: string, j: number) => (
            <Typography key={j} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
              • {r}
            </Typography>
          ))}
        </Box>
      ))}
      <RawJson data={data} />
    </Box>
  );
};

const PagespeedResult: React.FC<{ data: any }> = ({ data }) => {
  const vitals: Record<string, any> = data?.core_web_vitals ?? {};
  const scores: Record<string, any> = data?.category_scores ?? {};
  const opps: any[] = Array.isArray(data?.opportunities) ? data.opportunities : [];
  if (Object.keys(vitals).length === 0 && Object.keys(scores).length === 0 && opps.length === 0) {
    return <Empty label="vitals" />;
  }
  const vitalEntries = Object.entries(vitals).slice(0, 6);
  return (
    <Box sx={{ mt: 1 }}>
      {vitalEntries.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {vitalEntries.map(([k, v]) => (
            <Chip
              key={k}
              size="small"
              label={`${k.toUpperCase()}: ${typeof v === 'number' ? (k === 'cls' ? v : `${v}s`) : String(v)}`}
              variant="outlined"
            />
          ))}
        </Box>
      )}
      {Object.entries(scores).map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 110 }}>
            {k.replace(/_/g, ' ')}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, Number(v) || 0))}
            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 700 }}>
            {Number(v) || 0}
          </Typography>
        </Box>
      ))}
      {opps.slice(0, 5).map((o: any, i: number) => (
        <Typography key={i} variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.5 }}>
          • {o?.title ?? o?.id ?? JSON.stringify(o)}
          {o?.savings ? ` (${o.savings})` : ''}
        </Typography>
      ))}
      <RawJson data={data} />
    </Box>
  );
};

const SitemapResult: React.FC<{ data: any }> = ({ data }) => {
  const total: number | undefined = data?.total_urls;
  const urls: string[] = Array.isArray(data?.url_list) ? data.url_list : [];
  if (total === undefined && urls.length === 0) return <Empty label="sitemap data" />;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
        {total ?? urls.length} urls
      </Typography>
      {urls.slice(0, 5).map((u, i) => (
        <Typography
          key={i}
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.7)', display: 'block', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {u}
        </Typography>
      ))}
      {urls.length > 5 && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          +{urls.length - 5} more
        </Typography>
      )}
      <RawJson data={data} />
    </Box>
  );
};

const ImageAltResult: React.FC<{ data: any }> = ({ data }) => {
  if (!data?.alt_text) return <Empty label="alt text" />;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
        “{data.alt_text}”
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
        {data.confidence !== undefined && (
          <Chip size="small" label={`confidence ${Math.round(Number(data.confidence) * 100)}%`} variant="outlined" />
        )}
        {(data.keywords_included ?? []).map((k: string, i: number) => (
          <Chip key={i} size="small" label={k} variant="outlined" />
        ))}
      </Box>
      {(data.suggestions ?? []).slice(0, 3).map((s: string, i: number) => (
        <Typography key={i} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 0.5 }}>
          • {s}
        </Typography>
      ))}
      <RawJson data={data} />
    </Box>
  );
};

const OpengraphResult: React.FC<{ data: any }> = ({ data }) => {
  const tags: Record<string, any> = data?.og_tags ?? {};
  const entries = Object.entries(tags);
  if (entries.length === 0) return <Empty label="tags" />;
  const issues: string[] = data?.validation?.issues ?? [];
  return (
    <Box sx={{ mt: 1 }}>
      <Table size="small">
        <TableBody>
          {entries.map(([k, v]) => (
            <TableRow key={k}>
              <TableCell sx={{ color: '#90CAF9', border: 0, py: 0.5, fontSize: '0.75rem' }}>{k}</TableCell>
              <TableCell sx={{ color: 'white', border: 0, py: 0.5, fontSize: '0.75rem' }}>
                {String(v ?? '—')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data?.platform_optimized && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Optimized for {data.platform_optimized}
        </Typography>
      )}
      {issues.length > 0 && (
        <Typography variant="caption" sx={{ color: '#FFB74D', display: 'block' }}>
          {issues.length} validation issue{issues.length === 1 ? '' : 's'}
        </Typography>
      )}
      {(data?.recommendations ?? []).slice(0, 2).map((r: string, i: number) => (
        <Typography key={i} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
          • {r}
        </Typography>
      ))}
      <RawJson data={data} />
    </Box>
  );
};

const SectionScores: React.FC<{ sections: { label: string; score?: number; issues?: string[] }[] }> = ({ sections }) => (
  <Box sx={{ mt: 1 }}>
    {sections.map((s) => (
      <Box key={s.label} sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 90 }}>
            {s.label}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, Number(s.score) || 0))}
            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" sx={{ color: scoreColor(Number(s.score) || 0), fontWeight: 700 }}>
            {s.score ?? '?'}
          </Typography>
        </Box>
        {(s.issues ?? []).slice(0, 3).map((issue, i) => (
          <Typography key={i} variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
            • {issue}
          </Typography>
        ))}
      </Box>
    ))}
  </Box>
);

const OnPageResult: React.FC<{ data: any }> = ({ data }) => {
  if (data?.overall_score === undefined) return <Empty label="scores" />;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
        Overall {data.overall_score}
      </Typography>
      <SectionScores
        sections={[
          { label: 'Meta', score: data?.meta?.score, issues: data?.meta?.issues },
          { label: 'Technical', score: data?.technical?.score, issues: data?.technical?.issues },
          {
            label: `Content${data?.content_health?.word_count ? ` (${data.content_health.word_count} words)` : ''}`,
            score: data?.content_health?.score,
            issues: data?.content_health?.issues,
          },
        ]}
      />
      <RawJson data={data} />
    </Box>
  );
};

const TechnicalResult: React.FC<{ data: any }> = ({ data }) => {
  const issues: any[] = Array.isArray(data?.technical_issues) ? data.technical_issues : [];
  const structure: Record<string, any> = data?.site_structure ?? {};
  if (issues.length === 0 && Object.keys(structure).length === 0) {
    return <Empty label="findings" />;
  }
  return (
    <Box sx={{ mt: 1 }}>
      {issues.slice(0, 6).map((issue: any, i: number) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
          <Chip
            size="small"
            label={issue?.severity ?? 'info'}
            sx={{
              color:
                issue?.severity === 'High'
                  ? '#F44336'
                  : issue?.severity === 'Medium'
                    ? '#FF9800'
                    : '#4CAF50',
            }}
            variant="outlined"
          />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {issue?.type ?? JSON.stringify(issue)}
          </Typography>
        </Box>
      ))}
      {Object.keys(structure).length > 0 && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mt: 1 }}>
          {[
            structure.h1_count !== undefined ? `H1: ${structure.h1_count}` : null,
            structure.internal_links !== undefined ? `internal: ${structure.internal_links}` : null,
            structure.external_links !== undefined ? `external: ${structure.external_links}` : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Typography>
      )}
      <RawJson data={data} />
    </Box>
  );
};

// Phase 7 (8H): BatchRequester summary — counts + per-URL status chips.
// Uses only fields the BatchRequester contract guarantees (BatchRequestResult:
// url / status / error / errorKind / attempts); missing pieces degrade to
// honest empty text, never a crash.
const batchStatusColor = (status: string): string =>
  status === 'success' ? '#4CAF50' : status === 'error' ? '#F44336' : '#FF9800';

const BatchResult: React.FC<{ data: any }> = ({ data }) => {
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  if (results.length === 0) return <Empty label="batch results" />;
  const succeeded = results.filter((r) => r?.status === 'success').length;
  const failed = results.filter((r) => r?.status === 'error').length;
  const cancelled = results.filter((r) => r?.status === 'cancelled').length;
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        {succeeded > 0 && <Chip size="small" label={`${succeeded} succeeded`} variant="outlined" sx={{ color: '#4CAF50' }} />}
        {failed > 0 && <Chip size="small" label={`${failed} failed`} variant="outlined" sx={{ color: '#F44336' }} />}
        {cancelled > 0 && <Chip size="small" label={`${cancelled} cancelled`} variant="outlined" sx={{ color: '#FF9800' }} />}
      </Box>
      {results.map((r, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
          <Chip
            size="small"
            label={r?.status ?? '?' + (r?.errorKind ? ` · ${r.errorKind}` : '')}
            sx={{ color: batchStatusColor(r?.status) }}
            variant="outlined"
          />
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flexGrow: 1,
            }}
          >
            {r?.url ?? '?'}
            {r?.error ? ` — ${r.error}` : ''}
          </Typography>
          {r?.attempts !== undefined && r?.attempts > 1 && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {r.attempts} tries
            </Typography>
          )}
        </Box>
      ))}
      <RawJson data={data} />
    </Box>
  );
};

export const ToolResultView: React.FC<{ toolId: string; data: any }> = ({ toolId, data }) => {
  switch (toolId) {
    case 'meta':
      return <MetaResult data={data} />;
    case 'pagespeed':
      return <PagespeedResult data={data} />;
    case 'sitemap':
      return <SitemapResult data={data} />;
    case 'image-alt':
      return <ImageAltResult data={data} />;
    case 'opengraph':
      return <OpengraphResult data={data} />;
    case 'on-page':
      return <OnPageResult data={data} />;
    case 'technical':
      return <TechnicalResult data={data} />;
    case 'batch':
      return <BatchResult data={data} />;
    default:
      return (
        <Box
          component="pre"
          sx={{
            mt: 1, p: 1.5, maxHeight: 220, overflow: 'auto', fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1,
          }}
        >
          {JSON.stringify(data ?? null, null, 2)}
        </Box>
      );
  }
};
