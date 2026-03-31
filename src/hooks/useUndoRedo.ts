import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initialState: T) {
  const [state, setInternalState] = useState<{
    history: T[];
    index: number;
  }>({
    history: [initialState],
    index: 0,
  });

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setInternalState((prev) => {
      const current = prev.history[prev.index];
      const resolvedNewState = typeof newState === 'function' ? (newState as any)(current) : newState;
      
      if (JSON.stringify(resolvedNewState) === JSON.stringify(current)) return prev;

      const nextHistory = prev.history.slice(0, prev.index + 1);
      return {
        history: [...nextHistory, resolvedNewState],
        index: nextHistory.length,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setInternalState((prev) => ({
      ...prev,
      index: Math.max(0, prev.index - 1),
    }));
  }, []);

  const redo = useCallback(() => {
    setInternalState((prev) => ({
      ...prev,
      index: Math.min(prev.history.length - 1, prev.index + 1),
    }));
  }, []);

  return {
    state: state.history[state.index],
    setState,
    undo,
    redo,
    canUndo: state.index > 0,
    canRedo: state.index < state.history.length - 1,
  };
}
