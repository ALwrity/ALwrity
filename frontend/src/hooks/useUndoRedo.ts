import { useState, useCallback, useEffect } from 'react';

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

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setState((current) => {
      const resolvedValue = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(current.present) 
        : newValue;
      
      if (resolvedValue === current.present) return current;
      
      const newPast = [...current.past, current.present].slice(-limit);
      return {
        past: newPast,
        present: resolvedValue,
        future: [],
      };
    });
  }, [limit]);

  /** Undo one step; returns restored present, or undefined if nothing to undo. */
  const undo = useCallback((): T | undefined => {
    let restored: T | undefined;
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      restored = previous;
      const newPast = current.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
    return restored;
  }, []);

  /** Redo one step; returns restored present, or undefined if nothing to redo. */
  const redo = useCallback((): T | undefined => {
    let restored: T | undefined;
    setState((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      restored = next;
      const newFuture = current.future.slice(1);
      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
    return restored;
  }, []);

  const reset = useCallback((newValue: T) => {
    setState({
      past: [],
      present: newValue,
      future: [],
    });
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