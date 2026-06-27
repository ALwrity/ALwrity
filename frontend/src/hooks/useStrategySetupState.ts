import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

const WIZARD_BASE = '/api/content-planning/enhanced-strategies/wizard';

export interface WizardStepData {
  step1?: Record<string, any>;
  step2?: Record<string, any>;
  step3?: Record<string, any>;
}

export interface WizardState {
  id?: number;
  user_id?: string;
  current_step: number;
  status: 'active' | 'completed';
  step_data: WizardStepData | null;
  progress: number;
}

export interface StrategyInfo {
  strategy: Record<string, any> | null;
  is_active: boolean;
  active_strategy_id: number | null;
}

export interface UseStrategySetupState {
  state: WizardState | null;
  loading: boolean;
  error: string | null;
  setStep: (step: number) => Promise<void>;
  saveStepData: (stepData: Partial<WizardStepData>) => Promise<void>;
  setProgress: (progress: number) => Promise<void>;
  completeWizard: () => Promise<void>;
  resetWizard: () => Promise<void>;
  refreshState: () => Promise<void>;
  getLatestStrategy: () => Promise<StrategyInfo>;
  activateStrategy: (strategyId: number) => Promise<void>;
  getActiveStrategy: () => Promise<Record<string, any> | null>;
}

export function useStrategySetupState(): UseStrategySetupState {
  const [state, setState] = useState<WizardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`${WIZARD_BASE}/state`);
      const data = res.data?.data;
      if (data) {
        setState({
          id: data.id,
          user_id: data.user_id,
          current_step: data.current_step,
          status: data.status,
          step_data: data.step_data,
          progress: data.progress,
        });
      } else {
        setState(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load wizard state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const setStep = useCallback(async (step: number) => {
    try {
      setError(null);
      const res = await apiClient.put(`${WIZARD_BASE}/state`, { current_step: step });
      const data = res.data?.data;
      if (data) {
        setState(prev => prev ? { ...prev, current_step: data.current_step } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to update step');
    }
  }, []);

  const saveStepData = useCallback(async (stepData: Partial<WizardStepData>) => {
    try {
      setError(null);
      const res = await apiClient.put(`${WIZARD_BASE}/state`, { step_data: stepData });
      const data = res.data?.data;
      if (data) {
        setState(prev => prev ? { ...prev, step_data: data.step_data } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save step data');
    }
  }, []);

  const setProgress = useCallback(async (progress: number) => {
    try {
      setError(null);
      const res = await apiClient.put(`${WIZARD_BASE}/state`, { progress });
      const data = res.data?.data;
      if (data) {
        setState(prev => prev ? { ...prev, progress: data.progress } : null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to update progress');
    }
  }, []);

  const completeWizard = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.post(`${WIZARD_BASE}/complete`);
      const data = res.data?.data;
      if (data) {
        setState({
          id: data.id,
          user_id: data.user_id,
          current_step: data.current_step,
          status: data.status,
          step_data: data.step_data,
          progress: data.progress,
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to complete wizard');
    }
  }, []);

  const resetWizard = useCallback(async () => {
    try {
      setError(null);
      await apiClient.delete(`${WIZARD_BASE}/state`);
      setState(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to reset wizard');
    }
  }, []);

  const getLatestStrategy = useCallback(async (): Promise<StrategyInfo> => {
    try {
      const res = await apiClient.get(`${WIZARD_BASE}/strategy/latest`);
      const data = res.data?.data;
      if (data?.strategy) {
        return {
          strategy: data.strategy,
          is_active: data.is_active ?? false,
          active_strategy_id: data.active_strategy_id ?? null,
        };
      }
      return { strategy: null, is_active: false, active_strategy_id: null };
    } catch {
      return { strategy: null, is_active: false, active_strategy_id: null };
    }
  }, []);

  const activateStrategy = useCallback(async (strategyId: number) => {
    try {
      setError(null);
      await apiClient.post(`${WIZARD_BASE}/strategy/activate`, { strategy_id: strategyId });
      await saveStepData({ step2: { activated_strategy_id: strategyId } });
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to activate strategy');
      throw err;
    }
  }, [saveStepData]);

  const getActiveStrategy = useCallback(async (): Promise<Record<string, any> | null> => {
    try {
      const res = await apiClient.get(`${WIZARD_BASE}/strategy/active`);
      const data = res.data?.data;
      return data?.strategy || null;
    } catch {
      return null;
    }
  }, []);

  return {
    state,
    loading,
    error,
    setStep,
    saveStepData,
    setProgress,
    completeWizard,
    resetWizard,
    refreshState,
    getLatestStrategy,
    activateStrategy,
    getActiveStrategy,
  };
}
