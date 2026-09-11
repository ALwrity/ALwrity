/**
 * Phase 4 — SemanticIndexEducationDialog render tests.
 *
 * The end-user education dialog explains the Semantic Index in plain language
 * (no SIF jargon): the 8 indexed parts of the active content strategy, how AI
 * agents will use them to ground their answers, and — honestly — that the
 * agent-querying connection ships in a separate, later update (SIF-G). It must
 * NOT claim agents can query the index today.
 *
 * Controlled component: no hook is mocked; the card owns open/close and passes
 * the live document kind names from the status payload.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import SemanticIndexEducationDialog, {
  SIF_KIND_PRESENTATION,
} from '../SemanticIndexEducationDialog';

const KIND_NAMES = Object.keys(SIF_KIND_PRESENTATION);

/** Plain-language labels for the 8 canonical STRATEGY_KINDS, in contract order. */
const EXPECTED_PARTS = [
  'Your strategy questionnaire',
  'Strategy foundation',
  'Strategic insights',
  'Competitive analysis',
  'Performance predictions',
  'Implementation roadmap',
  'Risk assessment',
  'Your audience persona',
];

const renderDialog = (
  over: Partial<React.ComponentProps<typeof SemanticIndexEducationDialog>> = {},
) =>
  render(<SemanticIndexEducationDialog open onClose={() => {}} {...over} />);

describe('SemanticIndexEducationDialog — Phase 4: education dialog', () => {
  it('covers exactly the 8 canonical indexed kinds', () => {
    expect(KIND_NAMES).toHaveLength(8);
    expect(KIND_NAMES).toEqual([
      'form_summary',
      'base_strategy',
      'strategic_insights',
      'competitive_analysis',
      'performance_predictions',
      'implementation_roadmap',
      'risk_assessment',
      'user_persona_digest',
    ]);
  });

  it('renders nothing while closed', () => {
    render(<SemanticIndexEducationDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('explains what the Semantic Index is in plain language', () => {
    renderDialog();
    expect(screen.getByText('What is the Semantic Index?')).toBeTruthy();
    expect(screen.getByText(/searchable knowledge base/i)).toBeTruthy();
  });

  it('lists all 8 indexed parts by default (canonical fallback)', () => {
    renderDialog();
    for (const label of EXPECTED_PARTS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('renders the live document kind names when provided', () => {
    const { rerender } = renderDialog({ documentKindNames: KIND_NAMES });
    for (const label of EXPECTED_PARTS) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    rerender(
      <SemanticIndexEducationDialog
        open
        onClose={() => {}}
        documentKindNames={['form_summary', 'base_strategy']}
      />,
    );
    expect(screen.getByText('Your strategy questionnaire')).toBeTruthy();
    expect(screen.getByText('Strategy foundation')).toBeTruthy();
    expect(screen.queryByText('Risk assessment')).toBeNull();
  });

  it('is honest: agent querying is the next step, not something that works today', () => {
    renderDialog();
    // Positive: the agent-querying connection is future work (SIF-G).
    expect(screen.getAllByText(/next step/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/separate update/i)).toBeTruthy();
    // Negative: no claim that agents can query the index right now.
    expect(screen.queryByText(/can .* query the index (now|today)/i)).toBeNull();
    expect(screen.queryByText(/querying the index (now|today)/i)).toBeNull();
    expect(screen.queryByText(/searchable by agents (now|today)/i)).toBeNull();
  });

  it('closes when the user clicks "Got it"', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});