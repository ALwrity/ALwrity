import React from 'react';
import type { DailyPostIdea } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, dismissBtn, primaryBtn, rowBase, CONFIDENCE_COLORS, colors } from './styles';

interface StrategyBriefCardProps {
  theme: string;
  weekOf: string;
  dailyPosts: DailyPostIdea[];
  keyTopics: string[];
  focusArea: string;
  dataSourceSummary: string;
  onDismiss?: () => void;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
  'How-to': '#0a66c2',
  'Case study': '#9333ea',
  'Hot take': '#dc2626',
  'Personal story': '#059669',
  'Roundup': '#d97706',
  'Thought leadership': '#0891b2',
  'Tutorial': '#0a66c2',
};

const CONTENT_TYPE_EMOJIS: Record<string, string> = {
  'How-to': '🛠️',
  'Case study': '📊',
  'Hot take': '🔥',
  'Personal story': '💭',
  'Roundup': '📋',
  'Thought leadership': '💡',
  'Tutorial': '📝',
};

export const StrategyBriefCard: React.FC<StrategyBriefCardProps> = React.memo(({
  theme,
  weekOf,
  dailyPosts,
  keyTopics,
  focusArea,
  dataSourceSummary,
  onDismiss,
  onGeneratePost,
}) => {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!dailyPosts || dailyPosts.length === 0) {
    return <EmptyState icon="📅" message="Weekly strategy not available. Check back after connecting your LinkedIn account." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">📅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
              Weekly Content Strategy
            </div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>
              Week of {formatDate(weekOf)}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={dismissBtn} title="Dismiss" aria-label="Dismiss weekly strategy">
            ✕
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: colors.badgeBg,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Weekly Theme
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.textDark, marginTop: 2 }}>
          &ldquo;{theme}&rdquo;
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {dailyPosts.map((post, i) => (
          <DayRow
            key={i}
            post={post}
            theme={theme}
            onGeneratePost={onGeneratePost}
          />
        ))}
      </div>

      {keyTopics.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMedium, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Key Topics to Cover
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {keyTopics.map((t, i) => (
              <span
                key={i}
                style={{
                  padding: '3px 10px',
                  background: '#eff6ff',
                  color: '#1e40af',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid #bfdbfe',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: '#faf5ff',
          borderRadius: 8,
          border: '1px solid #e9d5ff',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          This Week's Focus
        </div>
        <div style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.5 }}>
          🎯 {focusArea}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// DayRow sub-component
// ---------------------------------------------------------------------------
interface DayRowProps {
  post: DailyPostIdea;
  theme: string;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const DayRow: React.FC<DayRowProps> = React.memo(({ post, theme, onGeneratePost }) => {
  const color = CONTENT_TYPE_COLORS[post.content_type] || '#64748b';
  const emoji = CONTENT_TYPE_EMOJIS[post.content_type] || '📌';

  return (
    <div style={rowBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: colors.textDark, minWidth: 50 }}>
          {post.day}
        </span>
        <span
          style={{
            padding: '2px 8px',
            background: `${color}15`,
            color,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {emoji} {post.content_type}
        </span>
        <span
          style={{
            background: (CONFIDENCE_COLORS[post.confidence] || CONFIDENCE_COLORS.medium).bg,
            color: (CONFIDENCE_COLORS[post.confidence] || CONFIDENCE_COLORS.medium).text,
            padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontSize: 10,
          }}
        >
          {post.confidence} priority
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: colors.textDark, marginBottom: 4 }}>
        &ldquo;{post.headline}&rdquo;
      </div>

      <div style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4 }}>
        Hook: {post.hook}
      </div>

      <div style={{ fontSize: 11, color: colors.textMedium, lineHeight: 1.4 }}>
        💡 {post.why_this_works}
      </div>

      {onGeneratePost && (
        <button
          onClick={() => onGeneratePost({ topic: post.headline, context: `Weekly strategy: ${post.day} - ${post.content_type} post. Theme: "${theme}". Hook: ${post.hook}` })}
          style={{ ...primaryBtn, marginTop: 8 }}
          aria-label={`Generate post for ${post.day}`}
        >
          Generate Post ✨
        </button>
      )}
    </div>
  );
});