/**
 * MySavedIdeas — small modal showing the user's saved Brainstorm ideas.
 *
 * Sourced from the per-user /api/brainstorm/saved-ideas endpoints. Each
 * idea card shows the prompt + rationale, with Copy and Delete actions.
 *
 * This is the "library" half of Feature #2 (Save-to-Library for Brainstorm).
 * Without it, the Save button in BrainstormFlow has nowhere to surface the
 * saved items.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../../api/client';

export interface SavedBrainstormIdea {
  id: string;
  prompt: string;
  rationale?: string | null;
  tags?: string;
  source_seed?: string | null;
  created_at: string;
  updated_at: string;
}

interface MySavedIdeasProps {
  open: boolean;
  onClose: () => void;
  onAfterDelete?: () => void;
  onUseInCopilot?: (prompt: string) => void;
}

const PANEL_STYLE: React.CSSProperties = {
  background: '#ffffff',
  width: 720,
  maxWidth: '100%',
  maxHeight: '80vh',
  borderRadius: 16,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const HEADER_STYLE: React.CSSProperties = {
  padding: '14px 18px',
  background: '#0a66c2',
  color: '#ffffff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const ITEM_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  background: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const ACTION_BTN_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const PRIMARY_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: '#0a66c2',
  color: '#ffffff',
  border: 'none',
};

const SECONDARY_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: '#ffffff',
  color: '#475569',
  border: '1px solid #cbd5e1',
};

const DANGER_BTN_STYLE: React.CSSProperties = {
  ...ACTION_BTN_STYLE,
  background: '#ffffff',
  color: '#b91c1c',
  border: '1px solid #fecaca',
};

async function loadSavedIdeas(): Promise<{ ideas: SavedBrainstormIdea[]; total: number }> {
  const res = await apiClient.get('/api/brainstorm/saved-ideas', {
    params: { limit: 100, offset: 0 },
  });
  return {
    ideas: Array.isArray(res.data?.ideas) ? res.data.ideas : [],
    total: Number(res.data?.total) || 0,
  };
}

async function deleteSavedIdea(id: string): Promise<void> {
  await apiClient.delete(`/api/brainstorm/saved-ideas/${encodeURIComponent(id)}`);
}

function formatRelative(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const MySavedIdeas: React.FC<MySavedIdeasProps> = ({
  open,
  onClose,
  onAfterDelete,
  onUseInCopilot,
}) => {
  const [ideas, setIdeas] = useState<SavedBrainstormIdea[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadSavedIdeas();
      setIdeas(result.ideas);
      setTotal(result.total);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load saved ideas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const handleCopy = useCallback(async (idea: SavedBrainstormIdea) => {
    try {
      await navigator.clipboard.writeText(idea.prompt);
      setCopiedId(idea.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === idea.id ? null : prev)), 1800);
    } catch (e) {
      console.error('Copy failed', e);
    }
  }, []);

  const handleDelete = useCallback(
    async (idea: SavedBrainstormIdea) => {
      const ok = window.confirm(
        `Delete this saved idea?\n\n"${idea.prompt.slice(0, 80)}${idea.prompt.length > 80 ? '...' : ''}"`
      );
      if (!ok) return;
      setDeletingId(idea.id);
      try {
        await deleteSavedIdea(idea.id);
        await refresh();
        onAfterDelete?.();
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to delete idea');
      } finally {
        setDeletingId(null);
      }
    },
    [refresh, onAfterDelete]
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10020,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={PANEL_STYLE}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="My Saved Brainstorm Ideas"
      >
        <div style={HEADER_STYLE}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📚 My Saved Ideas</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {loading
                ? 'Loading…'
                : `${total} saved idea${total === 1 ? '' : 's'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved ideas"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              padding: '6px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 18, background: '#f8fafc' }}>
          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {loading && ideas.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              Loading your saved ideas…
            </div>
          )}

          {!loading && !error && ideas.length === 0 && (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: '#64748b',
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                No saved ideas yet
              </div>
              <div style={{ fontSize: 12 }}>
                Run a brainstorm and tap the bookmark on any idea to keep it.
              </div>
            </div>
          )}

          {ideas.length > 0 && (
            <div style={{ display: 'grid', gap: 10 }}>
              {ideas.map((idea) => (
                <div key={idea.id} style={ITEM_STYLE}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#0f172a',
                      lineHeight: 1.4,
                    }}
                  >
                    {idea.prompt}
                  </div>
                  {idea.rationale && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#64748b',
                        lineHeight: 1.45,
                      }}
                    >
                      {idea.rationale}
                    </div>
                  )}
                  {idea.source_seed && (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      <span style={{ fontWeight: 600 }}>From seed:</span>{' '}
                      {idea.source_seed}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      Saved {formatRelative(idea.created_at)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {onUseInCopilot && (
                        <button
                          type="button"
                          onClick={() => onUseInCopilot(idea.prompt)}
                          style={SECONDARY_BTN_STYLE}
                        >
                          Use in Copilot
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy(idea)}
                        style={PRIMARY_BTN_STYLE}
                      >
                        {copiedId === idea.id ? 'Copied ✓' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(idea)}
                        disabled={deletingId === idea.id}
                        style={DANGER_BTN_STYLE}
                      >
                        {deletingId === idea.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySavedIdeas;
