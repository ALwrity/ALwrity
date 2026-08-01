import React, { useCallback, useState } from 'react';
import type { BrainstormIdea, BrainstormSource } from '../../hooks/usePlanWedgeBrainstorm';
import BrainstormSourcePill from './BrainstormSourcePill';
import { resolveIdeaSources } from './brainstormSourceUtils';

interface BrainstormIdeaSourcesProps {
  idea: BrainstormIdea;
  sources: BrainstormSource[];
  cardKey: string | number;
  cardIndex?: number;
  allowIndexFallback?: boolean;
  preferTooltipAboveRight?: boolean;
}

const BrainstormIdeaSources: React.FC<BrainstormIdeaSourcesProps> = ({
  idea,
  sources,
  cardKey,
  cardIndex,
  allowIndexFallback = false,
  preferTooltipAboveRight = false,
}) => {
  const linkedSources = resolveIdeaSources(idea, sources, {
    cardIndex,
    allowIndexFallback,
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((sourceIndex: number) => {
    const key = `${cardKey}-${sourceIndex}`;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [cardKey]);

  if (linkedSources.length === 0) return null;

  return (
    <div className="plan-wedge-brainstorm__idea-sources">
      {linkedSources.map(({ index, source }) => (
        <BrainstormSourcePill
          key={index}
          sourceIndex={index}
          source={source}
          expanded={expandedKeys.has(`${cardKey}-${index}`)}
          onToggleExpand={() => toggleExpanded(index)}
          preferTooltipAboveRight={preferTooltipAboveRight}
        />
      ))}
    </div>
  );
};

export default BrainstormIdeaSources;
