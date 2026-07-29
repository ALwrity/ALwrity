import { useState, useCallback, useEffect, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initialValue: T, options?: { limit?: number }) {
  const limit = options?.limit ?? 50;
  
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

  const undo = useCallback(() => {
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      const newFuture = current.future.slice(1);
      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newValue: T) => {
    setState({
      past: [],
      present: newValue,
      future: [],
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
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
  }, [undo, redo]);

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