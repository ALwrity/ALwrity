/**
 * DailyDigestWidget — F3 Analytics Dashboard feature
 *
 * Reads the alwrity_growth_engine sessionStorage cache and surfaces
 * the top post opportunity, content gap, and trending topic with
 * one-click "Create Post" CTAs. Falls back to a single CTA that
 * opens the Growth Engine modal when the cache is empty.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { linkedInGrowthApi, type ConsolidatedGrowthResponse } from '../../../../services/linkedInGrowthApi';
import { openGrowthEngineModal } from '../../utils/linkedInDashboardEvents';

const GROWTH_CACHE_KEY = 'alwrity_growth_engine';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── cache helpers ───────────────────────────────────────────────────────────

function readCache(): { data: ConsolidatedGrowthResponse; cachedAt: number } | null {
  try {
    const raw = sessionStorage.getItem(GROWTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { data: ConsolidatedGrowthResponse; cachedAt: number };
  } catch { return null; }
}

function cacheAgeLabel(cachedAt: number): string {
  const mins = Math.round((Date.now() - cachedAt) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function openQuickCreate(topic: string) {
  window.dispatchEvent(
    new CustomEvent('linkedinwriter:openQuickCreate', { detail: { type: 'post', topic } })
  );
}

// ─── component ───────────────────────────────────────────────────────────────

interface DigestRow {
  icon: string;
  label: string;
  topic: string;
  hook?: string;
}

function buildDigest(data: ConsolidatedGrowthResponse): DigestRow[] {
  const rows: DigestRow[] = [];

  // 1. Best post opportunity (trending topic #1)
  const topTrend = data.trending?.trending_topics?.[0];
  if (topTrend) {
    rows.push({
      icon: '🔥',
      label: "Today's trend",
      topic: topTrend.topic,
      hook: topTrend.suggested_hook,
    });
  }

  // 2. Top content gap
  const topGap = data.content_gaps?.gaps?.[0];
  if (topGap) {
    rows.push({
      icon: '💡',
      label: 'Content gap',
      topic: topGap.gap_topic,
      hook: topGap.suggested_angle,
    });
  }

  // 3. Weekly strategy pick (today's day)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()] ?? '';
  const todayPost = data.weekly_strategy?.daily_posts?.find(
    dp => dp.day?.toLowerCase().startsWith(today.toLowerCase().slice(0, 3))
  ) ?? data.weekly_strategy?.daily_posts?.[0];
  if (todayPost) {
    rows.push({
      icon: '📅',
      label: "Today's plan",
      topic: todayPost.headline,
      hook: todayPost.hook,
    });
  }

  return rows.slice(0, 3);
}

interface DailyDigestWidgetProps {
  /** Inline, no header separator needed when shown independently */
  compact?: boolean;
}

export const DailyDigestWidget: React.FC<DailyDigestWidgetProps> = ({ compact = false }) => {
  const [rows, setRows] = useState<DigestRow[]>([]);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFromCache = useCallback(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      setRows(buildDigest(cached.data));
      setCachedAt(cached.cachedAt);
      return true;
    }
    return false;
  }, []);

  useEffect(() => { loadFromCache(); }, [loadFromCache]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await linkedInGrowthApi.analyzeAll();
      sessionStorage.setItem(GROWTH_CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
      setRows(buildDigest(data));
      setCachedAt(Date.now());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const isEmpty = rows.length === 0 && !loading;

  return (
    <div style={{ marginTop: compact ? 0 : 4 }}>
      {!compact && (
        <div style={{ height: 1, background: '#e2e8f0', margin: '0 0 6px' }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          AI Daily Digest
        </span>
        {cachedAt && !loading && (
          <span style={{ fontSize: 7, color: '#94a3b8' }}>
            {cacheAgeLabel(cachedAt)}
            {' · '}
            <button type="button" onClick={() => void handleRefresh()} style={{ background: 'none', border: 'none', color: '#0a66c2', cursor: 'pointer', fontSize: 7, padding: 0, fontWeight: 700 }}>
              Refresh
            </button>
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ fontSize: 9, color: '#94a3b8', padding: '6px 0', textAlign: 'center' }}>
          Generating insights…
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
          <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.4, marginBottom: 6 }}>
            Run AI analysis to get today's post opportunities.
          </div>
          <button
            type="button"
            onClick={openGrowthEngineModal}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '4px 8px',
              background: '#0a66c2',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Open Growth Engine →
          </button>
        </div>
      )}

      {/* Digest rows */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 5,
                padding: '5px 6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 10, flexShrink: 0 }}>{row.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 7, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {row.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: '#0f172a',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                    title={row.topic}
                  >
                    {row.topic}
                  </div>
                </div>
              </div>
              {row.hook && (
                <div
                  style={{
                    fontSize: 8,
                    color: '#64748b',
                    fontStyle: 'italic',
                    lineHeight: 1.3,
                    marginBottom: 3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {row.hook}
                </div>
              )}
              <button
                type="button"
                onClick={() => openQuickCreate(row.topic)}
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  padding: '2px 6px',
                  background: '#eff6ff',
                  color: '#0a66c2',
                  border: '1px solid #bfdbfe',
                  borderRadius: 3,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Create Post →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
