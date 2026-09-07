/**
 * Phase H #34 + #39 — ContentStrategyBuilder render + "click Create →
 * strategy created" integration.
 *
 * Real stores (seeded via setState), MemoryRouter wrapper, Clerk module
 * mocked, and the contentPlanningApi service module mocked with a
 * proxy-backed spy factory. The review gate is satisfied through the REAL
 * localStorage persistence (strategy_reviewed_categories) so the click
 * exercises: wrapper review gate → enterprise modal → handleProceed →
 * useStrategyCreation → generateWithPolling → onComplete → strategy visible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/contentPlanningApi', () => ({
  contentPlanningApi: new Proxy({} as Record<string, any>, {
    get(target: any, prop: string) {
      if (prop === '__esModule') return true;
      if (!target[prop]) {
        // Any un-mocked store call is a benign no-op.
        target[prop] = vi.fn(async () => ({}));
      }
      return target[prop];
    },
  }),
}));

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'clerk-e2e' } }),
}));

import ContentStrategyBuilder from './components/ContentStrategyBuilder';
import { contentPlanningApi } from '../../services/contentPlanningApi';
import { useStrategyBuilderStore, STRATEGIC_INPUT_FIELDS } from '../../stores/strategyBuilderStore';
import { useEnhancedStrategyStore } from '../../stores/enhancedStrategyStore';

const CANONICAL = [
  'business_context',
  'audience_intelligence',
  'competitive_intelligence',
  'content_strategy',
  'performance_analytics',
];

const seedRequiredFields = () => {
  const formData: Record<string, any> = {};
  STRATEGIC_INPUT_FIELDS.forEach((f) => {
    if (!f.required) return;
    formData[f.id] =
      f.type === 'multiselect' ? ['Argon'] : f.type === 'boolean' ? true : f.type === 'number' ? 10 : 'E2E value';
  });
  useStrategyBuilderStore.setState({ formData, error: null, formErrors: {} });
};

// Clean slate for every test: mocks, stores, storage.
const seededReset = () => {
  useStrategyBuilderStore.setState({ formData: {}, error: null, formErrors: {}, saving: false, currentStrategy: null });
  useEnhancedStrategyStore.setState({ aiGenerating: false, educationalContent: null, transparencyModalOpen: false, currentStep: 0 });
  sessionStorage.clear();
  localStorage.removeItem('strategy_reviewed_categories');
};

const seedReviewedCategories = () => {
  localStorage.setItem('strategy_reviewed_categories', JSON.stringify(CANONICAL));
};

describe('ContentStrategyBuilder — render (#34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seededReset();
  });

  afterEach(() => {
    cleanup();
    useStrategyBuilderStore.setState({ formData: {}, error: null, formErrors: {}, saving: false });
    vi.useRealTimers();
  });

  const renderBuilder = () =>
    render(
      <MemoryRouter>
        <ContentStrategyBuilder />
      </MemoryRouter>,
    );

  it('renders the form surface with the Create CTA and no modal', () => {
    renderBuilder();
    expect(screen.getByText(/Create Strategy with AI/i)).toBeTruthy();
    expect(screen.queryByText(/Proceed with Current Strategy/i)).toBeNull();
  });

  it('shows the seeded error banner when the store carries an error', () => {
    useStrategyBuilderStore.setState({ error: 'Boom from seeded state' });
    renderBuilder();
    expect(screen.getByText(/Boom from seeded state/i)).toBeTruthy();
  });
});

describe('ContentStrategyBuilder — click Create → strategy created (#39 integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seededReset();
    seedRequiredFields();
    seedReviewedCategories();

    (contentPlanningApi as any).startStrategyGenerationPolling = vi.fn(async () => ({
      data: { task_id: 'e2e-task' },
    }));
    (contentPlanningApi as any).pollStrategyGeneration = vi.fn(
      (_taskId: string, _onProgress: any, onComplete: any, _onError: any) => {
        onComplete({ id: 55, name: 'E2E Strategy', strategic_insights: {} });
        return Promise.resolve();
      },
    );
    (useEnhancedStrategyStore.getState() as any).setAIGenerating(false);
  });

  afterEach(() => {
    cleanup();
    useStrategyBuilderStore.setState({ formData: {}, error: null, formErrors: {}, saving: false, currentStrategy: null });
    vi.useRealTimers();
  });

  it('click Create → enterprise modal → strategy lands in the store after polling', async () => {
    render(
      <MemoryRouter>
        <ContentStrategyBuilder />
      </MemoryRouter>,
    );

    // 1) The review gate passes (all 5 categories reviewed in REAL storage);
    //    Create opens the enterprise modal. HeaderSection renders the CTA
    //    more than once (responsive variants) — click the first enabled one.
    const createButtons = screen
      .getAllByRole('button', { name: /Create Strategy with AI/i })
      .filter((b) => !(b as HTMLButtonElement).disabled);
    expect(createButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(createButtons[0]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/Proceed with Current Strategy/i)).toBeTruthy();

    // 2) Proceed → 300ms transition delay → buildStrategyPayload → polling
    //    start → task id → fake poll completes synchronously → onComplete.
    //    (Drive exactly the documented delay — a full timer drain would hit
    //    the app's repeating effects under fake time.)
    await act(async () => {
      fireEvent.click(screen.getByText(/Proceed with Current Strategy/i));
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    // 3) The generated strategy reached the builder store.
    const current = useStrategyBuilderStore.getState().currentStrategy as any;
    expect(current).toBeTruthy();
    expect(current.id).toBe(55);
    expect(current.name).toBe('E2E Strategy');

    // 4) The educational modal is the single progress surface, now complete.
    expect(screen.getByText(/Next: Review Strategy and Create Calendar/i)).toBeTruthy();

    void contentPlanningApi;
  });
});



