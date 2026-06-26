import React, { useCallback, useState } from 'react';
import type { NetworkSuggestionItem } from '../../../../services/linkedInGrowthApi';
import { DataSourceBadge } from './DataSourceBadge';
import { EmptyState } from './EmptyState';
import { cardBase, headerRow, primaryBtn, secondaryBtn, rowBase, CONFIDENCE_COLORS, colors } from './styles';

interface NetworkSuggestionCardProps {
  suggestions: NetworkSuggestionItem[];
  dataSourceSummary: string;
}

export const NetworkSuggestionCard: React.FC<NetworkSuggestionCardProps> = React.memo(({
  suggestions,
  dataSourceSummary,
}) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (note: string, index: number) => {
    try {
      await navigator.clipboard.writeText(note);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = note;
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

  const visible = suggestions.filter((_, i) => !dismissed.has(i));

  if (visible.length === 0 && suggestions.length > 0) {
    return null;
  }

  if (suggestions.length === 0) {
    return <EmptyState icon="🤝" message="No network suggestions available. Connect your LinkedIn account for personalized recommendations." />;
  }

  return (
    <div style={cardBase}>
      <div style={headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }} aria-hidden="true">🤝</span>
          <div style={{ fontWeight: 700, fontSize: 15, color: colors.textDark }}>
            People to Connect With This Week
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {visible.map((person, i) => {
          const originalIndex = suggestions.indexOf(person);
          return (
            <PersonRow
              key={originalIndex}
              person={person}
              index={originalIndex}
              copied={copiedIndex === originalIndex}
              onCopy={handleCopy}
              onDismiss={handleDismiss}
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
// PersonRow sub-component
// ---------------------------------------------------------------------------
interface PersonRowProps {
  person: NetworkSuggestionItem;
  index: number;
  copied: boolean;
  onCopy: (note: string, index: number) => void;
  onDismiss: (index: number) => void;
}

const PersonRow: React.FC<PersonRowProps> = React.memo(({
  person,
  index,
  copied,
  onCopy,
  onDismiss,
}) => {
  return (
    <div style={rowBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">👤</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: colors.textDark }}>
            {person.name}
          </span>
          <span style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 6 }}>
            · {person.title} @ {person.company}
          </span>
        </div>
        <span
          style={{
            background: (CONFIDENCE_COLORS[person.confidence] || CONFIDENCE_COLORS.medium).bg,
            color: (CONFIDENCE_COLORS[person.confidence] || CONFIDENCE_COLORS.medium).text,
            padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontSize: 10,
            marginLeft: 'auto',
          }}
        >
          {person.confidence} priority
        </span>
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
        💬 {person.suggested_note}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onCopy(person.suggested_note, index)}
          style={{
            ...primaryBtn,
            background: copied ? colors.successBg : colors.primary,
            color: copied ? colors.successText : '#fff',
          }}
          aria-label={copied ? 'Connection note copied' : 'Copy connection note'}
        >
          {copied ? 'Copied ✓' : 'Copy Note'}
        </button>
        <button
          onClick={() => onDismiss(index)}
          style={secondaryBtn}
          aria-label="Dismiss suggestion"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
});