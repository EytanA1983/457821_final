/**
 * Performance Utilities
 * 
 * Tools for measuring and debugging React component performance
 */

import { createElement, useEffect, useRef, useState, type ComponentType } from 'react';

/**
 * Hook to track component render counts
 * Usage: const renderCount = useRenderCount('MyComponent');
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Render] ${componentName}: ${renderCount.current}`);
  }
  
  return renderCount.current;
}

/**
 * Hook to track which props changed and caused a re-render
 * Usage: useWhyDidYouUpdate('MyComponent', props);
 */
export function useWhyDidYouUpdate<T extends Record<string, any>>(
  componentName: string, 
  props: T
): void {
  const previousProps = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};
      
      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log(`[WhyDidYouUpdate] ${componentName}:`, changedProps);
      }
    }

    previousProps.current = props;
  });
}

/**
 * Hook to measure render time
 * Usage: const renderTime = useRenderTime('MyComponent');
 */
export function useRenderTime(componentName: string): void {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const endTime = performance.now();
    const duration = endTime - startTime.current;
    
    if (process.env.NODE_ENV === 'development' && duration > 16) {
      // Warn if render takes longer than one frame (16ms)
      console.warn(`[SlowRender] ${componentName}: ${duration.toFixed(2)}ms`);
    }
    
    startTime.current = performance.now();
  });
}

/**
 * HOC to wrap component with performance tracking
 */
export function withPerformanceTracking<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
): ComponentType<P> {
  return function PerformanceTrackedComponent(props: P) {
    useRenderCount(componentName);
    useWhyDidYouUpdate(componentName, props);
    useRenderTime(componentName);
    
    return createElement(WrappedComponent, props);
  };
}

/**
 * Utility to create a stable callback reference
 * Useful when you need a callback that doesn't change identity
 * but should always call the latest version
 */
export function useEventCallback<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef<T>(callback);
  
  useEffect(() => {
    ref.current = callback;
  });
  
  return useRef(((...args) => ref.current(...args)) as T).current;
}

/**
 * Debounce a value to prevent rapid updates
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle a callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useRef(((...args) => {
    if (Date.now() - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = Date.now();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, delay - (Date.now() - lastRan.current));
    }
  }) as T).current;
}

/**
 * Check if a value has changed (shallow comparison)
 */
export function shallowEqual<T extends Record<string, any>>(obj1: T, obj2: T): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Deep comparison for arrays (useful for memo comparisons)
 */
export function arraysEqual<T>(arr1: T[], arr2: T[], compareItems?: (a: T, b: T) => boolean): boolean {
  if (arr1.length !== arr2.length) return false;
  
  const compare = compareItems || ((a, b) => a === b);
  
  for (let i = 0; i < arr1.length; i++) {
    if (!compare(arr1[i], arr2[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Performance tips for React components:
 * 
 * 1. Use React.memo for components that receive the same props often
 * 2. Use useCallback for event handlers passed to child components
 * 3. Use useMemo for expensive calculations
 * 4. Avoid creating new objects/arrays in render (move to useMemo)
 * 5. Avoid anonymous functions in JSX (use useCallback)
 * 6. Use React.lazy for code splitting
 * 7. Use virtualization for long lists (react-window)
 * 8. Avoid unnecessary context providers high in the tree
 * 9. Split contexts by update frequency
 * 10. Use React DevTools Profiler to identify slow components
 */
