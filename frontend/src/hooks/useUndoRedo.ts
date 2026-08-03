import { useState, useCallback, useEffect, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export type UseUndoRedoOptions = {
  /** Max past snapshots to retain. Default 50. */
  limit?: number;
  /**
   * When true (default), Ctrl/Cmd+Z / Shift+Z / Y are handled on window.
   * Disable for native textareas so toolbar undo does not fight browser undo.
   */
  enableKeyboardShortcuts?: boolean;
};

export function useUndoRedo<T>(initialValue: T, options?: UseUndoRedoOptions) {
  const limit = options?.limit ?? 50;
  const enableKeyboardShortcuts = options?.enableKeyboardShortcuts ?? true;

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialValue,
    future: [],
  });

  // Keep a sync mirror so undo/redo can return the restored value immediately
  // (setState updater side-effects are not reliable under React 18 batching).
  const stateRef = useRef(state);
  stateRef.current = state;

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setState((current) => {
      const resolvedValue = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(current.present) 
        : newValue;
      
      if (resolvedValue === current.present) return current;
      
      const next: UndoRedoState<T> = {
        past: [...current.past, current.present].slice(-limit),
        present: resolvedValue,
        future: [],
      };
      stateRef.current = next;
      return next;
    });
  }, [limit]);

  /** Undo one step; returns restored present, or undefined if nothing to undo. */
  const undo = useCallback((): T | undefined => {
    const current = stateRef.current;
    if (current.past.length === 0) return undefined;

    const previous = current.past[current.past.length - 1];
    const next: UndoRedoState<T> = {
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future],
    };
    stateRef.current = next;
    setState(next);
    return previous;
  }, []);

  /** Redo one step; returns restored present, or undefined if nothing to redo. */
  const redo = useCallback((): T | undefined => {
    const current = stateRef.current;
    if (current.future.length === 0) return undefined;

    const upcoming = current.future[0];
    const next: UndoRedoState<T> = {
      past: [...current.past, current.present],
      present: upcoming,
      future: current.future.slice(1),
    };
    stateRef.current = next;
    setState(next);
    return upcoming;
  }, []);

  const reset = useCallback((newValue: T) => {
    const next: UndoRedoState<T> = {
      past: [],
      present: newValue,
      future: [],
    };
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, enableKeyboardShortcuts]);

  return {
    value: state.present,
    setValue,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    historyLength: state.past.length + state.future.length,
  };
}

export type { UndoRedoState };
