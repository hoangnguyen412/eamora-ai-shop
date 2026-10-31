import { useState, useEffect } from "react";

/**
 * Debounces a value by delaying updates until the user stops changing it
 * for the specified delay (in milliseconds).
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default 500ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
