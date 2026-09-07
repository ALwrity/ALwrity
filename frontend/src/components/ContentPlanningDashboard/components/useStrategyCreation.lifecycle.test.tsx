/**
 * Phase H #35 — useActionButtonsBusinessLogic lifecycle tests (the real hook
 * useStrategyCreation delegates to): double-click in-flight guard,
 * validation-failure naming (#24), typed errors + retry CTA (#17/#19),
 * missing-task-id recovery (#19), cancellation abort (#41), and the save
 * flow with post-save reload (#12/#16).
 *
 * Only Clerk is module-mocked. Both zustand stores run for real. The
 * contentPlanningApi is injected through the hook's `contentPlanningApi`
 * prop — exactly as the builder does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'clerk-42' } }),
}));

import { useActionButtonsBusinessLogic } from './ContentStrategyBuilder/components/ActionButtons';
import { useStrategyBuilderStore } from '../../../stores/strategyBuilderStore';

const goodFormData = { name: 'Test', industry: 'saas' };

const makeFakeApi = () => ({
  startStrategyGenerationPolling: vi.fn(async (): Promise<any> => ({ data: { task_id: 'task-1' } })),
  pollStrategyGeneration: vi.fn(),
  getEnhancedStrategy: vi.fn(async () => ({ id: 77, name: 'Fresh From DB', comprehensive_ai_analysis: { ok: 1 } })),
});

type HookOver = Record<string, any>;

const renderLogic = (api: ReturnType<typeof makeFakeApi>, base: HookOver = {}) => {
  const defaults = {
    setAIGenerating: vi.fn(),
    setError: vi.fn(),
    setCurrentStrategy: vi.fn(),
    setSaving: vi.fn(),
    setGenerationProgress: vi.fn(),
    setEducationalContent: vi.fn(),
    setShowEducationalModal: vi.fn(),
    onGenerationError: vi.fn(),
    setCurrentStep: vi.fn(),
  };
  const setters = { ...defaults, ...(base.setters ?? {}) };
  const { result } = renderHook(() =>
    useActionButtonsBusinessLogic({
      formData: base.formData ?? { name: 'Test', industry: 'saas' },
      error: base.error ?? null,
      currentStrategy: base.currentStrategy ?? null,
      validateAllFields: base.validateAllFields ?? vi.fn(() => true),
      getCompletionStats:
        base.getCompletionStats ??
        vi.fn(() => ({ completion_percentage: 50, filled_fields: 2, total_fields: 30, category_completion: {} })),
      generateAIRecommendations: base.generateAIRecommendations ?? vi.fn(async () => {}),
      createEnhancedStrategy: base.createEnhancedStrategy ?? vi.fn(async () => ({ id: 77, name: 'Created' })),
      ...setters,
      contentPlanningApi: base.api ?? api,
    } as any),
  );
  return { result, setters };
};

describe('useActionButtonsBusinessLogic — lifecycle', () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    useStrategyBuilderStore.setState({ formData: { name: 'Test', industry: 'saas' } });
    fakeApi = makeFakeApi();
  });

  it('double-click guard: only one generation starts for rapid calls', async () => {
    const { result } = renderLogic(fakeApi);

    await act(async () => {
      const first = result.current.handleCreateStrategy();
      const second = result.current.handleCreateStrategy(); // ref is still hot
      await first;
      await second;
    });

    expect(fakeApi.startStrategyGenerationPolling).toHaveBeenCalledTimes(1);
  });

  it('validation failure names the missing fields (#24) and never starts polling', async () => {
    useStrategyBuilderStore.setState({ formData: {} }); // nothing filled → 8 required empty

    const validateAllFields = vi.fn(() => false);
    const { result, setters } = renderLogic(fakeApi, { validateAllFields, setters: { setError: vi.fn() } });

    await act(async () => {
      await result.current.handleCreateStrategy();
    });

    expect(fakeApi.startStrategyGenerationPolling).not.toHaveBeenCalled();
    const msg = (setters.setError.mock?.calls?.map((c: any[]) => c[0]) as any[]).find(
      (v) => typeof v === 'string',
    ) as string;
    expect(msg).toMatch(/required/i);
    expect(String(msg)).toContain('Missing: Business Objectives');
  });

  it('missing task id surfaces a retryable error + retry CTA and closes the modal (#19)', async () => {
    fakeApi.startStrategyGenerationPolling.mockResolvedValueOnce({ data: {} });

    const { result, setters } = renderLogic(fakeApi, {
      setters: { setError: vi.fn(), onGenerationError: vi.fn(), setShowEducationalModal: vi.fn() },
    });

    await act(async () => {
      await result.current.handleCreateStrategy();
    });

    expect(fakeApi.pollStrategyGeneration).not.toHaveBeenCalled();
    const msg = (setters.setError.mock?.calls?.map((c: any[]) => c[0]) as any[]).find(
      (v) => typeof v === 'string',
    ) as string;
    expect(msg).toMatch(/No task ID received[^]*retry/i);
    expect(setters.onGenerationError).toHaveBeenCalled();
    expect(setters.setShowEducationalModal).toHaveBeenCalledWith(false);
  });

  it('poll onError path: retryable typed message + CTA + modal closed (#17)', async () => {
    fakeApi.pollStrategyGeneration.mockImplementation(
      (_t: any, _p: any, _c: any, onError: (m: string) => void) => {
        onError('AI service exploded');
        return Promise.resolve();
      },
    );

    const { result, setters } = renderLogic(fakeApi, {
      setters: { setError: vi.fn(), onGenerationError: vi.fn(), setShowEducationalModal: vi.fn() },
    });

    await act(async () => {
      await result.current.handleCreateStrategy();
    });

    const msg = (setters.setError.mock?.calls?.map((c: any[]) => c[0]) as any[]).find(
      (v) => typeof v === 'string',
    ) as string;
    expect(msg).toMatch(/Strategy generation failed: AI service exploded/);
    expect(setters.onGenerationError).toHaveBeenCalledWith(msg);
    expect(setters.setShowEducationalModal).toHaveBeenCalledWith(false);
  });

  it('cancelGeneration aborts the signal handed to the poll (#41)', async () => {
    let capturedSignal: AbortSignal | undefined;
    fakeApi.startStrategyGenerationPolling.mockResolvedValueOnce({ data: { task_id: 'task-9' } });
    fakeApi.pollStrategyGeneration.mockImplementation(
      (_t: any, _p: any, _c: any, _e: any, _i: any, _m: any, signal?: AbortSignal) => {
        capturedSignal = signal;
        return Promise.resolve();
      },
    );

    const { result, setters } = renderLogic(fakeApi, {
      setters: { setAIGenerating: vi.fn(), setShowEducationalModal: vi.fn() },
    });

    await act(async () => {
      await result.current.handleCreateStrategy();
    });
    expect(capturedSignal).toBeTruthy();
    expect(capturedSignal!.aborted).toBe(false);

    await act(async () => {
      result.current.cancelGeneration();
    });

    expect(capturedSignal!.aborted).toBe(true);
    expect(setters.setShowEducationalModal).toHaveBeenCalledWith(false);
    expect(setters.setAIGenerating).toHaveBeenCalledWith(false);
  });

  it('save sends the shared payload and re-reads the saved row (#12/#16)', async () => {
    const createEnhancedStrategy = vi.fn(async () => ({ id: 77, name: 'Created shallow' }));
    const { result } = renderLogic(fakeApi, { createEnhancedStrategy });

    await act(async () => {
      await result.current.handleSaveStrategy();
    });

    // Shared payload: complete form + metadata + auth user, no form-state id.
    expect(createEnhancedStrategy).toHaveBeenCalledTimes(1);
    const payload = createEnhancedStrategy.mock.calls[0][0];
    expect(payload.name).toBe('Test');
    expect(payload.data_source_transparency).toBeDefined();
    expect(payload.user_id).toBe('clerk-42');
    expect(payload.completion_percentage).toBe(50);
    expect(payload.id).toBeUndefined();

    // Post-save reload hits the backend for the freshly written row.
    expect(fakeApi.getEnhancedStrategy).toHaveBeenCalledWith(77);
  });
});

