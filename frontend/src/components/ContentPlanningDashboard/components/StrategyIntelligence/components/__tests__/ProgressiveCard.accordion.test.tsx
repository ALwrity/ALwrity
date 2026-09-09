/**
 * The strategy section cards must expand ONLY on explicit click (accordion
 * behavior) — never via hover/focus heuristics. The old `trigger="hover"`
 * mode expanded the card full-width (gridColumn 1/-1), auto-collapsed after
 * a delay, and showed "Hover to see more" / "Expanded to full width" labels.
 *
 * These tests lock in:
 *   1. Hovering does NOT reveal the details — click is the only trigger.
 *   2. Clicking "Read More" / "Show Less" toggles the details in place.
 *   3. A controlled accordion mode (expanded + onToggle) exists so the tab
 *      can enforce single-open semantics.
 *   4. Reviewing a section happens INLINE inside the expanded accordion —
 *      clicking Review expands the card and shows the confirmation panel in
 *      place. No modal/popup (Dialog) is used.
 *   5. The "Read More"/"Show Less" toggle is a prominent contained button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import React from 'react';
import ProgressiveCard from '../ProgressiveCard';
import { useStrategyReviewStore } from '../../../../../../stores/strategyReviewStore';

const source = readFileSync(
  resolve(__dirname, '../ProgressiveCard.tsx'),
  'utf-8',
);

const detailsMarker = 'Details revealed';
const summaryMarker = 'Summary visible';

const renderCard = (props: Record<string, any> = {}) =>
  render(
    <ProgressiveCard
      title="Strategic Insights"
      summary={<div>{summaryMarker}</div>}
      details={<div>{detailsMarker}</div>}
      {...props}
    />,
  );

beforeEach(() => {
  useStrategyReviewStore.setState({
    components: [],
    isReviewing: false,
    reviewProgress: 0,
    reviewProcessStarted: false,
  });
  useStrategyReviewStore.getState().initializeComponents([
    { id: 'strategic_insights', title: 'Strategic Insights', subtitle: 'AI-powered market analysis' },
  ]);
});

describe('ProgressiveCard — accordion behavior (no hover/focus expansion)', () => {
  it('source guard: no hover-trigger expansion heuristics remain', () => {
    expect(source).not.toMatch(/Hover to see more/);
    expect(source).not.toMatch(/Expanded to full width/);
    expect(source).not.toMatch(/onMouseEnter/);
    expect(source).not.toMatch(/onMouseLeave/);
    expect(source).not.toMatch(/trigger === 'hover'/);
    expect(source).not.toMatch(/gridColumn: isExpanded/);
  });

  it('hovering does NOT reveal the details (click is the only trigger)', () => {
    renderCard();
    expect(screen.getByText(summaryMarker)).toBeTruthy();
    expect(screen.queryByText(detailsMarker)).toBeNull();
    fireEvent.mouseEnter(screen.getByText(summaryMarker));
    expect(screen.queryByText(detailsMarker)).toBeNull();
  });

  it('clicking the toggle reveals then collapses the details in place', async () => {
    renderCard();
    expect(screen.queryByText(detailsMarker)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Read More/i }));
    expect(screen.getByText(detailsMarker)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show Less/i }));
    await waitForElementToBeRemoved(() => screen.queryByText(detailsMarker));
  });

  it('controlled mode: respects expanded prop and calls onToggle on click', () => {
    const onToggle = vi.fn();
    const { rerender } = renderCard({ expanded: false, onToggle });
    expect(screen.queryByText(detailsMarker)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Read More/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    // Controlled: even after a click, state stays driven by the parent prop.
    rerender(
      <ProgressiveCard
        summary={<div>{summaryMarker}</div>}
        details={<div>{detailsMarker}</div>}
        expanded={true}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText(detailsMarker)).toBeTruthy();
  });
});

describe('ProgressiveCard — inline review in the accordion (no modal popup)', () => {
  it('source guard: the review confirmation modal (Dialog) is gone', () => {
    expect(source).not.toMatch(/ReviewConfirmationDialog/);
    expect(source).not.toMatch(/showReviewDialog/);
    expect(source).not.toMatch(/<Dialog/);
  });

  it('source guard: Read More / Show Less is a prominent contained gradient button', () => {
    expect(source).toMatch(/Read More/);
    expect(source).toMatch(/Show Less/);
    expect(source).toMatch(/variant="contained"/);
    expect(source).toMatch(/linear-gradient/);
  });

  it('source guard: Review click expands the card and starts inline review', () => {
    expect(source).toMatch(/startReview\(/);
    expect(source).toMatch(/ReviewConfirmationPanel/);
    expect(source).toMatch(/componentStatus === 'in_review'/);
  });

  it('clicking Review expands the accordion and shows the inline review panel, not a dialog', () => {
    renderCard({ componentId: 'strategic_insights' });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(screen.getByText(detailsMarker)).toBeTruthy();
    expect(screen.getByText('Mark as Reviewed')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Mark as Reviewed completes the review inline (panel closes, status flips to reviewed)', () => {
    renderCard({ componentId: 'strategic_insights' });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(screen.getByText('Mark as Reviewed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Mark as Reviewed/i }));
    // The panel unmounts synchronously once the status flips in the store.
    expect(screen.queryByText('Mark as Reviewed')).toBeNull();
    expect(screen.getByText('Reviewed')).toBeTruthy();
    const component = useStrategyReviewStore
      .getState()
      .components.find((c) => c.id === 'strategic_insights');
    expect(component?.status).toBe('reviewed');
  });

  it('Cancel exits the inline review without marking reviewed', () => {
    renderCard({ componentId: 'strategic_insights' });
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(screen.getByText('Mark as Reviewed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByText('Mark as Reviewed')).toBeNull();
    expect(screen.getByText('Not Reviewed')).toBeTruthy();
    const component = useStrategyReviewStore
      .getState()
      .components.find((c) => c.id === 'strategic_insights');
    expect(component?.status).toBe('not_reviewed');
  });
});