import React, { useCallback, useState } from 'react';
import type { EngagementOpportunityItem } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, primaryBtn, greenBtn, secondaryBtn, rowBase, CONFIDENCE_COLORS, colors } from './styles';

interface EngagementCardProps {
  opportunities: EngagementOpportunityItem[];
  dataSourceSummary: string;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

export const EngagementCard: React.FC<EngagementCardProps> = React.memo(({
  opportunities,
  dataSourceSummary,
  onGeneratePost,
}) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  const handleDismiss = useCallback((index: number) => {
    setDismissed((prev) => new Set(prev).add(index));
  }, []);

  const visible = opportunities.filter((_, i) => !dismissed.has(i));

  if (visible.length === 0 && opportunities.length > 0) {
    return null;
  }

  if (opportunities.length === 0) {
    return <EmptyState icon="💬" message="No engagement opportunities found. Check back later for posts to engage with." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">💬</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            Engagement Opportunities
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {visible.map((item, i) => {
          const originalIndex = opportunities.indexOf(item);
          return (
            <EngagementRow
              key={originalIndex}
              item={item}
              index={originalIndex}
              copied={copiedIndex === originalIndex}
              onCopy={handleCopy}
              onDismiss={handleDismiss}
              onGeneratePost={onGeneratePost}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <DataSourceBadge label="Growth Engine" detail={dataSourceSummary} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// EngagementRow sub-component
// ---------------------------------------------------------------------------
interface EngagementRowProps {
  item: EngagementOpportunityItem;
  index: number;
  copied: boolean;
  onCopy: (text: string, index: number) => void;
  onDismiss: (index: number) => void;
  onGeneratePost?: (params?: { topic?: string; context?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const EngagementRow: React.FC<EngagementRowProps> = React.memo(({
  item,
  index,
  copied,
  onCopy,
  onDismiss,
  onGeneratePost,
}) => {
  return (
    <div style={rowBase}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.textDark, lineHeight: 1.4 }}>
          📢 {item.title}
        </div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          by {item.author} ({item.author_context})
          <span
            style={{
              background: (CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.medium).bg,
              color: (CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.medium).text,
              padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontSize: 10,
              display: 'inline-block',
            }}
          >
            {item.confidence} priority
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: colors.textMedium, marginBottom: 8, fontStyle: 'italic' }}>
        💡 {item.why_engage}
      </div>

      <div
        style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 10,
          fontSize: 13,
          color: colors.textBody,
          lineHeight: 1.5,
        }}
      >
        💬 {item.suggested_comment}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onCopy(item.suggested_comment, index)}
          style={{
            ...primaryBtn,
            background: copied ? colors.successBg : colors.primary,
            color: copied ? colors.successText : '#fff',
          }}
          aria-label={copied ? 'Comment copied' : 'Copy suggested comment'}
        >
          {copied ? 'Copied ✓' : 'Copy Comment'}
        </button>
        {onGeneratePost && (
          <button
            onClick={() => onGeneratePost({ topic: item.title, context: `Engaging with: "${item.title}" by ${item.author}. Suggested comment: ${item.suggested_comment}` })}
            style={greenBtn}
            aria-label={`Create post about ${item.title}`}
          >
            Create Post ✨
          </button>
        )}
        <button
          onClick={() => onDismiss(index)}
          style={secondaryBtn}
          aria-label="Dismiss opportunity"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
});