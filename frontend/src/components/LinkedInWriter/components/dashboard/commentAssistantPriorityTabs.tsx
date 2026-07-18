import React from 'react';
import { colors } from '../GrowthEngine/styles';
import { COMMENT_ASSISTANT_TABS } from './commentAssistantCopy';
import type { CommentAssistantTab } from './commentAssistantTypes';

const TABS: CommentAssistantTab[] = ['needs_reply', 'active', 'older', 'manual'];

interface CommentAssistantPriorityTabsProps {
  active: CommentAssistantTab;
  onChange: (tab: CommentAssistantTab) => void;
  counts?: Partial<Record<Exclude<CommentAssistantTab, 'manual'>, number>>;
}

export const CommentAssistantPriorityTabs: React.FC<CommentAssistantPriorityTabsProps> = ({
  active,
  onChange,
  counts,
}) => (
  <div
    role="tablist"
    aria-label="Comment priority"
    style={{
      display: 'flex',
      gap: 4,
      marginBottom: 12,
      flexWrap: 'wrap',
      borderBottom: `1px solid ${colors.border}`,
      paddingBottom: 8,
    }}
  >
    {TABS.map((tab) => {
      const selected = active === tab;
      const count = tab === 'manual' ? undefined : counts?.[tab];
      const label =
        count != null && count > 0
          ? `${COMMENT_ASSISTANT_TABS[tab]} (${count})`
          : COMMENT_ASSISTANT_TABS[tab];
      return (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(tab)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: selected ? `1px solid ${colors.primary}` : '1px solid transparent',
            background: selected ? '#eff6ff' : 'transparent',
            color: selected ? colors.primary : colors.textSecondary,
            fontSize: 12,
            fontWeight: selected ? 700 : 600,
            cursor: 'pointer',
            lineHeight: 1.2,
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);
