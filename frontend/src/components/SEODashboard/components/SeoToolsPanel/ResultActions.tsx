import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

// Result action bar (Phase T3): copy the run output as plain text and
// download a JSON report, mirroring SEOAnalysisController.handleDownloadReport.
// Copy degrades gracefully: navigator.clipboard when available, execCommand
// fallback otherwise — never throws into the result view.

/** Human-readable copy text per tool; falls back to pretty JSON. */
export function formatResultForCopy(toolId: string, data: unknown): string {
  const anyData = data as any;
  switch (toolId) {
    case 'meta': {
      const descriptions: string[] = (anyData?.meta_descriptions ?? [])
        .map((d: any) => d?.text)
        .filter(Boolean);
      if (descriptions.length > 0) return descriptions.join('\n\n');
      break;
    }
    case 'image-alt':
      if (typeof anyData?.alt_text === 'string') return anyData.alt_text;
      break;
    case 'opengraph': {
      const tags: Record<string, unknown> = anyData?.og_tags ?? {};
      const lines = Object.entries(tags).map(([k, v]) => `${k}: ${String(v)}`);
      if (lines.length > 0) return lines.join('\n');
      break;
    }
    default:
      break;
  }
  return JSON.stringify(data ?? null, null, 2);
}

/** Mirror of SEOAnalysisController.handleDownloadReport for a single tool run. */
export function downloadJsonReport(toolId: string, title: string, data: unknown): void {
  const payload = {
    tool: { id: toolId, title },
    ranAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seo-${toolId}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path rather than surfacing a clipboard error.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const ResultActions: React.FC<{
  toolId: string;
  title: string;
  data: unknown;
}> = ({ toolId, title, data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(formatResultForCopy(toolId, data));
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={handleCopy}
        sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
      >
        Copy
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => downloadJsonReport(toolId, title, data)}
        sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
      >
        Download JSON
      </Button>
      {copied && (
        <Typography variant="caption" sx={{ color: '#4CAF50' }}>
          Copied
        </Typography>
      )}
    </Box>
  );
};

export default ResultActions;