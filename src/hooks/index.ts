import { useEffect, useRef, useCallback, useState } from 'react';

// Hook for managing live data updates
export function useLiveUpdates(callback: () => void, interval: number = 5000) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(callback, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [callback, interval]);
}

// Hook for debouncing
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Hook for modal state
export function useModal(initialState: boolean = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

// Hook for handling keyboard shortcuts
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifier: 'ctrl' | 'shift' | 'alt' | 'meta' | null = null
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMatch = e.key.toLowerCase() === key.toLowerCase();
      const modifierMatch = modifier === null ||
        (modifier === 'ctrl' && e.ctrlKey) ||
        (modifier === 'shift' && e.shiftKey) ||
        (modifier === 'alt' && e.altKey) ||
        (modifier === 'meta' && e.metaKey);

      if (keyMatch && modifierMatch) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, modifier]);
}

// Hook for previous value
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// Hook for local component state persistence in memory
export function useMemoryState<T>(_key: string, initialValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    // Memory storage in React module scope
    return initialValue;
  });

  return [value, setValue];
}

// Hook for async operations
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);
    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (error) {
      setError(error as Error);
      setStatus('error');
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, value, error };
}

// Hook for viewport size
export function useViewportSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
